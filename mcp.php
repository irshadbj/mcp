<?php
/**
 * Memory MCP server backed by Supabase PostgREST.
 * Configure these environment variables on the PHP host:
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<server-side service_role/secret key>
 *   MCP_SECRET_KEY=<long random secret used by the MCP client>
 * Requires PHP 8+ and the cURL extension.
 */
declare(strict_types=1);

const SERVER_NAME = 'memory';
const SERVER_VERSION = '2.0.0';
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function env_required(string $name): string {
    $value = getenv($name);
    if ($value === false || trim($value) === '') {
        http_response_code(500);
        echo json_encode(['error' => 'server configuration error']);
        exit;
    }
    return trim($value);
}

$SUPABASE_URL = rtrim(env_required('SUPABASE_URL'), '/');
$SUPABASE_SERVICE_ROLE_KEY = env_required('SUPABASE_SERVICE_ROLE_KEY');
$MCP_SECRET_KEY = env_required('MCP_SECRET_KEY');

// Prefer X-MCP-Key or Authorization: Bearer <key>. Query-string key remains
// supported for legacy connectors, but headers are safer because URLs get logged.
$providedKey = (string)($_SERVER['HTTP_X_MCP_KEY'] ?? '');
if ($providedKey === '') {
    $auth = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) $providedKey = trim($m[1]);
}
if ($providedKey === '') $providedKey = (string)($_GET['key'] ?? '');
if (strlen($MCP_SECRET_KEY) < 32 || !hash_equals($MCP_SECRET_KEY, $providedKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method === 'DELETE') { http_response_code(200); exit; }
if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST, OPTIONS');
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

function supabase_request(string $method, string $path, ?array $body = null, array $extraHeaders = []): array {
    global $SUPABASE_URL, $SUPABASE_SERVICE_ROLE_KEY;
    $url = $SUPABASE_URL . '/rest/v1/' . ltrim($path, '/');
    $headers = array_merge([
        'apikey: ' . $SUPABASE_SERVICE_ROLE_KEY,
        'Authorization: Bearer ' . $SUPABASE_SERVICE_ROLE_KEY,
        'Accept: application/json',
    ], $extraHeaders);
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('Supabase request failed: ' . $curlError);
    $decoded = $raw === '' ? null : json_decode($raw, true);
    if ($status < 200 || $status >= 300) {
        // Do not send credentials or upstream internals back to the MCP caller.
        throw new RuntimeException('Supabase request failed with HTTP ' . $status);
    }
    return ['status' => $status, 'data' => $decoded, 'raw' => $raw];
}

function clean_tags(string $tags): string {
    $parts = array_filter(array_map(static fn($t) => strtolower(trim($t)), explode(',', $tags)), 'strlen');
    $parts = array_values(array_unique(array_map(static fn($t) => str_replace(',', '', $t), $parts)));
    sort($parts, SORT_STRING);
    return implode(',', $parts);
}

function fmt(array $row): array {
    $tags = (string)($row['tags'] ?? '');
    return [
        'id' => (int)$row['id'],
        'content' => (string)$row['content'],
        'tags' => $tags === '' ? [] : explode(',', $tags),
        'created_at' => (string)$row['created_at'],
        'updated_at' => (string)$row['updated_at'],
    ];
}

function tool_remember(array $a): array {
    $content = trim((string)($a['content'] ?? ''));
    if ($content === '') return ['error' => 'content is empty'];
    $res = supabase_request('POST', 'memories?select=id', [
        'content' => $content,
        'tags' => clean_tags((string)($a['tags'] ?? '')),
    ], ['Prefer: return=representation']);
    $row = is_array($res['data']) ? ($res['data'][0] ?? null) : null;
    if (!$row || !isset($row['id'])) throw new RuntimeException('Supabase insert returned no ID');
    return ['saved' => true, 'id' => (int)$row['id']];
}

function tool_recall(array $a): array {
    $limit = max(1, min((int)($a['limit'] ?? 5), 50));
    $terms = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower((string)($a['query'] ?? '')), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $terms = array_slice(array_values(array_unique($terms)), 0, 8);
    if (!$terms) return ['count' => 0, 'memories' => []];

    // Retrieve a bounded candidate set, then rank locally to preserve the old
    // MySQL implementation's content/tag keyword scoring behavior.
    $res = supabase_request('GET', 'memories?select=id,content,tags,created_at,updated_at&order=id.desc&limit=1000');
    $rows = is_array($res['data']) ? $res['data'] : [];
    $ranked = [];
    foreach ($rows as $row) {
        $hayContent = mb_strtolower((string)$row['content']);
        $hayTags = mb_strtolower((string)$row['tags']);
        $score = 0;
        foreach ($terms as $term) {
            if (mb_stripos($hayContent, $term) !== false) $score++;
            if (mb_stripos($hayTags, $term) !== false) $score++;
        }
        if ($score > 0) $ranked[] = ['score' => $score, 'row' => $row];
    }
    usort($ranked, static fn($x, $y) => ($y['score'] <=> $x['score']) ?: ((int)$y['row']['id'] <=> (int)$x['row']['id']));
    $memories = array_map(static fn($item) => fmt($item['row']), array_slice($ranked, 0, $limit));
    return ['count' => count($memories), 'memories' => $memories];
}

function tool_list(array $a): array {
    $limit = max(1, min((int)($a['limit'] ?? 20), 100));
    $offset = max(0, (int)($a['offset'] ?? 0));
    $tag = strtolower(trim((string)($a['tag'] ?? '')));
    if ($tag === '') {
        $query = 'memories?select=id,content,tags,created_at,updated_at&order=id.desc&limit=' . $limit . '&offset=' . $offset;
        $res = supabase_request('GET', $query);
        $rows = is_array($res['data']) ? $res['data'] : [];
    } else {
        // Filter before applying offset/limit to preserve the original tool semantics.
        $res = supabase_request('GET', 'memories?select=id,content,tags,created_at,updated_at&order=id.desc&limit=1000');
        $all = is_array($res['data']) ? $res['data'] : [];
        $filtered = array_values(array_filter($all, static function ($row) use ($tag) {
            $tags = (string)($row['tags'] ?? '');
            return in_array($tag, $tags === '' ? [] : explode(',', $tags), true);
        }));
        $rows = array_slice($filtered, $offset, $limit);
    }
    return ['count' => count($rows), 'memories' => array_map('fmt', $rows)];
}

function tool_update(array $a): array {
    $id = (int)($a['id'] ?? 0);
    $content = trim((string)($a['content'] ?? ''));
    if ($id < 1) return ['error' => 'invalid id'];
    if ($content === '') return ['error' => 'content is empty'];
    $existing = supabase_request('GET', 'memories?select=tags&id=eq.' . $id . '&limit=1');
    $row = is_array($existing['data']) ? ($existing['data'][0] ?? null) : null;
    if (!$row) return ['error' => "no memory with id $id"];
    $tags = array_key_exists('tags', $a) && $a['tags'] !== null
        ? clean_tags((string)$a['tags']) : (string)$row['tags'];
    supabase_request('PATCH', 'memories?id=eq.' . $id, [
        'content' => $content,
        'tags' => $tags,
        'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    ]);
    return ['updated' => true, 'id' => $id];
}

function tool_forget(array $a): array {
    $id = (int)($a['id'] ?? 0);
    if ($id < 1) return ['deleted' => false, 'id' => $id];
    $res = supabase_request('DELETE', 'memories?id=eq.' . $id, null, ['Prefer: return=representation']);
    $deleted = is_array($res['data']) && count($res['data']) > 0;
    return ['deleted' => $deleted, 'id' => $id];
}

$TOOLS = [
    ['name' => 'remember', 'description' => 'Save a new memory: a durable fact, preference, decision, or context worth keeping across conversations. tags is an optional comma-separated list.', 'inputSchema' => ['type' => 'object', 'properties' => ['content' => ['type' => 'string', 'description' => 'The memory text'], 'tags' => ['type' => 'string', 'description' => 'Comma-separated tags (optional)']], 'required' => ['content']]],
    ['name' => 'recall', 'description' => 'Search memories by keywords (matches content and tags, best matches first). Call at the start of a task to check for relevant saved context.', 'inputSchema' => ['type' => 'object', 'properties' => ['query' => ['type' => 'string'], 'limit' => ['type' => 'integer', 'description' => 'Max results (default 5, max 50)']], 'required' => ['query']]],
    ['name' => 'list_memories', 'description' => 'List memories, newest first. Optionally filter by a single tag.', 'inputSchema' => ['type' => 'object', 'properties' => ['limit' => ['type' => 'integer'], 'offset' => ['type' => 'integer'], 'tag' => ['type' => 'string']]]],
    ['name' => 'update_memory', 'description' => 'Replace the content (and optionally tags) of an existing memory by id. Prefer this over saving a near-duplicate when a fact changes.', 'inputSchema' => ['type' => 'object', 'properties' => ['id' => ['type' => 'integer'], 'content' => ['type' => 'string'], 'tags' => ['type' => 'string']], 'required' => ['id', 'content']]],
    ['name' => 'forget', 'description' => 'Permanently delete a memory by id.', 'inputSchema' => ['type' => 'object', 'properties' => ['id' => ['type' => 'integer']], 'required' => ['id']]],
];
$HANDLERS = ['remember' => 'tool_remember', 'recall' => 'tool_recall', 'list_memories' => 'tool_list', 'update_memory' => 'tool_update', 'forget' => 'tool_forget'];

function rpc_result($id, $result): array { return ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result]; }
function rpc_error($id, int $code, string $msg): array { return ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $msg]]; }

function handle(array $msg): ?array {
    global $TOOLS, $HANDLERS;
    $id = $msg['id'] ?? null;
    $method = $msg['method'] ?? '';
    $params = is_array($msg['params'] ?? null) ? $msg['params'] : [];
    if (!array_key_exists('id', $msg)) return null;
    switch ($method) {
        case 'initialize':
            $req = (string)($params['protocolVersion'] ?? '');
            $ver = in_array($req, SUPPORTED_PROTOCOLS, true) ? $req : SUPPORTED_PROTOCOLS[0];
            return rpc_result($id, ['protocolVersion' => $ver, 'capabilities' => ['tools' => ['listChanged' => false]], 'serverInfo' => ['name' => SERVER_NAME, 'version' => SERVER_VERSION]]);
        case 'ping': return rpc_result($id, new stdClass());
        case 'tools/list': return rpc_result($id, ['tools' => $TOOLS]);
        case 'tools/call':
            $name = (string)($params['name'] ?? '');
            if (!isset($HANDLERS[$name])) return rpc_error($id, -32602, "Unknown tool: $name");
            try {
                $out = $HANDLERS[$name](is_array($params['arguments'] ?? null) ? $params['arguments'] : []);
                $isErr = isset($out['error']);
            } catch (Throwable $e) {
                error_log('Memory MCP backend error: ' . $e->getMessage());
                $out = ['error' => 'server error'];
                $isErr = true;
            }
            return rpc_result($id, ['content' => [['type' => 'text', 'text' => json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]], 'isError' => $isErr]);
        default: return rpc_error($id, -32601, "Method not found: $method");
    }
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(rpc_error(null, -32700, 'Parse error'));
    exit;
}
$isBatch = array_is_list($data) && count($data) > 0;
$responses = [];
foreach ($isBatch ? $data : [$data] as $message) {
    if (!is_array($message)) { $responses[] = rpc_error(null, -32600, 'Invalid request'); continue; }
    $response = handle($message);
    if ($response !== null) $responses[] = $response;
}
if (!$responses) { http_response_code(202); exit; }
echo json_encode($isBatch ? $responses : $responses[0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
