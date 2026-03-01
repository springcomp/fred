#!/usr/bin/env python3
"""Parse VSCode Copilot Chat JSONL session logs into a human-readable audit trail.

Extracts per-turn: user prompt, chain-of-thought thinking, tool invocations,
file edits, agent response text, and token usage statistics.
"""

import json
import os
import re
import sys
from datetime import datetime

# Fix encoding for Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')


# ---------------------------------------------------------------------------
# JSONL parser — reconstructs the live session state from delta operations
# ---------------------------------------------------------------------------

def _array_push(arr, value, i_val):
    """Apply a kind=2 array-push operation with optional i-truncation.

    When i_val is present it means 'truncate arr to i_val items, then append'.
    This is how VS Code records incremental streaming updates: a later push at
    the same i supersedes all earlier partial pushes at that position.
    """
    if i_val is not None:
        del arr[i_val:]
    if isinstance(value, list):
        arr.extend(value)
    elif value is not None:
        arr.append(value)


def parse_jsonl(filepath):
    """Reconstruct the final session state from a JSONL delta log."""
    session = {}
    requests = []

    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            kind = entry.get('kind')
            keys = entry.get('k', [])
            value = entry.get('v')
            i_val = entry.get('i')   # optional truncation index

            if kind == 0:
                session = value or {}
                requests = session.get('requests', [])

            elif kind == 1:
                # Property set — skip ephemeral input-box state entirely
                if keys and keys[0] == 'inputState':
                    continue
                if keys and keys[0] == 'requests' and len(keys) >= 3:
                    idx = int(keys[1])
                    while len(requests) <= idx:
                        requests.append({})
                    req = requests[idx]
                    if not isinstance(req, dict):
                        continue
                    prop = keys[2]
                    if len(keys) == 3:
                        req[prop] = value
                    elif len(keys) == 4:
                        if prop not in req:
                            req[prop] = {}
                        if isinstance(req[prop], dict):
                            req[prop][keys[3]] = value
                elif keys and keys[0] != 'requests':
                    obj = session
                    for k in keys[:-1]:
                        if k not in obj:
                            obj[k] = {}
                        obj = obj[k]
                    obj[keys[-1]] = value

            elif kind == 2:
                if keys == ['requests']:
                    # Top-level requests array push / reset via i-truncation
                    _array_push(requests, value, i_val)
                elif len(keys) >= 3 and keys[0] == 'requests':
                    idx = int(keys[1])
                    while len(requests) <= idx:
                        requests.append({})
                    req = requests[idx]
                    if not isinstance(req, dict):
                        continue
                    prop = keys[2]
                    if prop not in req:
                        req[prop] = []
                    if isinstance(req[prop], list):
                        _array_push(req[prop], value, i_val)

    session['requests'] = requests
    return session


# ---------------------------------------------------------------------------
# Turn extraction — pulls structured data from a reconstructed session
# ---------------------------------------------------------------------------

def _extract_first_uri_path(im):
    """Extract the first file path from an invocationMessage dict's uris field."""
    if not isinstance(im, dict):
        return ''
    uris = im.get('uris', {})
    if not isinstance(uris, dict):
        return ''
    for url_key, obj in uris.items():
        if isinstance(obj, dict):
            p = obj.get('fsPath') or obj.get('path', '')
            if p:
                # Return just the filename + parent folder for brevity
                parts = p.replace('\\', '/').split('/')
                return '/'.join(parts[-2:]) if len(parts) > 1 else p
        break
    return ''


def _get_invocation_label(item):
    """Return a short human-readable label for a tool invocation."""
    tool_id = item.get('toolId', 'unknown')
    im = item.get('invocationMessage', '')
    if isinstance(im, dict):
        raw = im.get('value', '') or ''
        # Check if the raw value contains empty markdown anchors [](url)
        has_empty_anchor = bool(re.search(r'\[\]\(', raw))
        # Remove empty anchors (and any trailing comma+space) cleanly
        label = re.sub(r'\[\]\([^)]*\),?\s*', '', raw)
        # Strip remaining markdown link syntax [text](url) -> text
        label = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', label).strip()
        label = re.sub(r'\s+', ' ', label).strip()
        # When anchors had no text, supplement with the file path from uris
        if has_empty_anchor:
            uri_path = _extract_first_uri_path(im)
            if uri_path:
                label = (label + ' ' + uri_path).strip() if label else uri_path
    else:
        label = str(im).strip()

    tsd = item.get('toolSpecificData', {})
    if isinstance(tsd, dict):
        # Subagent: use its description
        if tsd.get('kind') == 'subagent':
            desc = tsd.get('description', '')
            if desc:
                label = desc
        # Todo list: build a summary of items
        elif tsd.get('kind') == 'todoList':
            todos = tsd.get('todoList', [])
            in_prog = [t['title'] for t in todos if t.get('status') == 'in-progress']
            done = [t['title'] for t in todos if t.get('status') == 'completed']
            parts = []
            if in_prog:
                parts.append('active: ' + '; '.join(in_prog))
            if done:
                parts.append(str(len(done)) + ' done')
            if parts:
                label = 'Todo \u2014 ' + ', '.join(parts)
            else:
                label = 'Todo list update (' + str(len(todos)) + ' items)'
        # Terminal command — commandLine.original holds the actual command text
        elif tsd.get('kind') == 'terminal':
            cl = tsd.get('commandLine', {})
            cmd = (cl.get('original', '') if isinstance(cl, dict) else '') or tsd.get('command', '') or label
            label = cmd[:120] if cmd else label

    if not label:
        label = tool_id
    return tool_id, label


def _extract_file_paths(uris_or_uri):
    """Extract a list of file paths from a uri/uris field.

    Handles both:
      - A single VS Code URI object: {$mid, fsPath, path, scheme, ...}
      - A uris dict mapping URL strings to URI objects: {url: {fsPath, ...}}
    """
    paths = []
    if isinstance(uris_or_uri, dict):
        # Single VS Code URI object — has 'fsPath' or 'path' directly
        if 'fsPath' in uris_or_uri or ('path' in uris_or_uri and 'scheme' in uris_or_uri):
            p = uris_or_uri.get('fsPath') or uris_or_uri.get('path', '')
            if p:
                paths.append(p)
        else:
            # uris dict: {url_string: {fsPath, path, ...}}
            for url_or_path, obj in uris_or_uri.items():
                if isinstance(obj, dict):
                    p = obj.get('fsPath') or obj.get('path', '')
                    if p:
                        paths.append(p)
                else:
                    paths.append(str(url_or_path))
    elif isinstance(uris_or_uri, str):
        paths.append(uris_or_uri)
    return paths


def extract_turns(session):
    """Extract audit-trail turns from a parsed session, skipping canceled ones."""
    turns = []
    for req in session.get('requests', []):
        if not isinstance(req, dict):
            continue

        # Skip canceled requests (user hit Stop before any response)
        result = req.get('result') or {}
        error = result.get('errorDetails', {})
        if isinstance(error, dict) and error.get('code') == 'canceled':
            continue

        turn = {
            'prompt': '',
            'response_text': '',
            'thinking_blocks': [],   # list of {'title': str, 'text': str}
            'tool_calls': [],        # list of {'tool_id': str, 'label': str, 'sub_calls': int, 'is_subagent': bool}
            'file_edits': [],        # list of file paths that were modified/created
            'model': '',
            'timestamp': None,
            'timings': {},
            'usage': {},
            'prompt_token_breakdown': [],
        }

        msg = req.get('message', {})
        if isinstance(msg, dict):
            turn['prompt'] = msg.get('text', '')

        turn['model'] = req.get('modelId', '')
        turn['timestamp'] = req.get('timestamp')

        # --- Result: timings + token usage ---
        if isinstance(result, dict):
            turn['timings'] = result.get('timings') or {}
            usage = result.get('usage') or {}
            if usage:
                turn['usage'] = {
                    'prompt_tokens': usage.get('promptTokens', 0),
                    'completion_tokens': usage.get('completionTokens', 0),
                }
                turn['prompt_token_breakdown'] = usage.get('promptTokenDetails', [])

        # --- Response items ---
        subagent_sub_calls = {}   # subAgentInvocationId -> count
        seen_tool_call_ids = set()
        edited_files = set()

        for item in req.get('response', []):
            if not isinstance(item, dict):
                continue
            item_kind = item.get('kind')

            # --- Text response (no 'kind' field — streaming markdown chunks) ---
            if item_kind is None and 'value' in item:
                text = item.get('value', '')
                if isinstance(text, str):
                    turn['response_text'] += text

            # --- Inline references (symbol names or file URIs between text chunks) ---
            elif item_kind == 'inlineReference':
                ref = item.get('inlineReference', {})
                if isinstance(ref, dict):
                    name = ref.get('name', '')
                    if name:
                        turn['response_text'] += '`' + name + '`'
                    elif 'fsPath' in ref or ('path' in ref and 'scheme' in ref):
                        # Bare file URI — extract short filename
                        fp = ref.get('fsPath') or ref.get('path', '')
                        if fp:
                            parts = fp.replace('\\', '/').split('/')
                            short = parts[-1] if parts else fp
                            turn['response_text'] += '[' + short + '](' + short + ')'

            # --- Chain-of-thought thinking ---
            elif item_kind == 'thinking':
                text = item.get('value', '')
                # Items with empty id and vscodeReasoningDone=True are "end" markers
                meta = item.get('metadata', {})
                if isinstance(meta, dict) and meta.get('vscodeReasoningDone'):
                    continue
                if text:
                    title = item.get('generatedTitle', '') or ''
                    turn['thinking_blocks'].append({'title': title, 'text': text})

            # --- Tool invocations ---
            elif item_kind == 'toolInvocationSerialized':
                call_id = item.get('toolCallId', '')
                sub_id = item.get('subAgentInvocationId')

                if sub_id:
                    # This is a nested call inside a subagent — count it
                    subagent_sub_calls[sub_id] = subagent_sub_calls.get(sub_id, 0) + 1
                    continue

                # Top-level tool call — deduplicate by callId (re-deliveries)
                if call_id and call_id in seen_tool_call_ids:
                    continue
                if call_id:
                    seen_tool_call_ids.add(call_id)

                tool_id, label = _get_invocation_label(item)
                tsd = item.get('toolSpecificData', {}) or {}
                is_subagent = isinstance(tsd, dict) and tsd.get('kind') == 'subagent'

                turn['tool_calls'].append({
                    'tool_id': tool_id,
                    'label': label,
                    'call_id': call_id,
                    'is_subagent': is_subagent,
                    'sub_calls': 0,   # filled in below
                })

                # Collect file paths for read invocations
                im = item.get('invocationMessage', {})
                if isinstance(im, dict):
                    uris = im.get('uris', {})
                    if uris:
                        for p in _extract_file_paths(uris):
                            pass  # reads are not edits

            # --- File edits ---
            elif item_kind == 'textEditGroup':
                uri = item.get('uri', {})
                paths = _extract_file_paths(uri if uri else {})
                for p in paths:
                    edited_files.add(p)

        # Attach sub-call counts to subagent entries
        for tc in turn['tool_calls']:
            if tc['is_subagent']:
                tc['sub_calls'] = subagent_sub_calls.get(tc['call_id'], 0)

        turn['file_edits'] = sorted(edited_files)
        turns.append(turn)

    return turns


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def fmt_ts(ts):
    if ts:
        return datetime.fromtimestamp(ts / 1000).strftime('%Y-%m-%d %H:%M:%S')
    return 'unknown'


def fmt_duration(ms):
    if not ms:
        return '?'
    s = ms / 1000
    if s < 60:
        return f'{s:.1f}s'
    return f'{s//60:.0f}m {s%60:.0f}s'


def fmt_tokens(n):
    return f'{n:,}'


def wrap_text(text, width=100, indent='  '):
    """Simple word-wrap for long text blocks."""
    words = text.split()
    lines = []
    cur = indent
    for word in words:
        if len(cur) + len(word) + 1 > width and cur.strip():
            lines.append(cur.rstrip())
            cur = indent + word + ' '
        else:
            cur += word + ' '
    if cur.strip():
        lines.append(cur.rstrip())
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dirs = [
        r"<paste-path-to-workspace-storage-here>\bf748491efd995d8c8e900dafa0ca87a\chatSessions",
        r"<paste-path-to-workspace-storage-here>\02d3c7cfaec983e3ff6cba9fc7b21a34\chatSessions",
    ]

    all_sessions = []

    for d in dirs:
        for fname in sorted(os.listdir(d)):
            if not fname.endswith('.jsonl'):
                continue
            fpath = os.path.join(d, fname)
            if os.path.getsize(fpath) < 2000:
                continue

            session = parse_jsonl(fpath)
            turns = extract_turns(session)

            if not turns or all(not t['prompt'].strip() for t in turns):
                continue

            timestamps = [t['timestamp'] for t in turns if t['timestamp']]
            first_ts = min(timestamps) if timestamps else 0

            all_sessions.append({
                'file': fpath,
                'session_id': session.get('sessionId', fname.replace('.jsonl', '')),
                'title': session.get('customTitle', ''),
                'creation_date': session.get('creationDate'),
                'first_timestamp': first_ts,
                'turns': turns,
            })

    all_sessions.sort(key=lambda s: s['first_timestamp'])

    W = 100  # output width
    DIVIDER = '=' * W
    SUBDIV  = '-' * W

    print(f'Found {len(all_sessions)} non-empty sessions')
    print()

    for si, sess in enumerate(all_sessions):
        title = sess['title'] or sess['session_id']
        total_prompt = sum(t['usage'].get('prompt_tokens', 0) for t in sess['turns'])
        total_completion = sum(t['usage'].get('completion_tokens', 0) for t in sess['turns'])

        print(DIVIDER)
        print(f'SESSION {si+1}: {title}')
        print(f'  ID:      {sess["session_id"]}')
        print(f'  Created: {fmt_ts(sess["creation_date"])}')
        print(f'  Turns:   {len(sess["turns"])}')
        if total_prompt or total_completion:
            print(f'  Tokens:  {fmt_tokens(total_prompt)} prompt  +  {fmt_tokens(total_completion)} completion  =  {fmt_tokens(total_prompt + total_completion)} total')
        print(DIVIDER)

        for ti, turn in enumerate(sess['turns']):
            elapsed = turn['timings'].get('totalElapsed')
            first_tok = turn['timings'].get('firstProgress')
            model_short = turn['model'].split('/')[-1] if turn['model'] else '?'

            print()
            print(f'  ┌── TURN {ti+1}  [{fmt_ts(turn["timestamp"])}]'
                  f'  model={model_short}'
                  + (f'  duration={fmt_duration(elapsed)}'
                     f'  (first token: {fmt_duration(first_tok)})' if elapsed else ''))

            # USER PROMPT
            prompt = turn['prompt'].strip()
            print(f'  │')
            print(f'  ├─ USER')
            if prompt:
                for line in prompt.splitlines():
                    print(f'  │    {line}')
            else:
                print(f'  │    (no prompt text)')

            # THINKING
            if turn['thinking_blocks']:
                total_chars = sum(len(b['text']) for b in turn['thinking_blocks'])
                print(f'  │')
                print(f'  ├─ THINKING  ({len(turn["thinking_blocks"])} block(s), {total_chars:,} chars)')
                for bi, block in enumerate(turn['thinking_blocks']):
                    label = block['title'] or f'block {bi+1}'
                    preview = block['text'][:300].replace('\n', ' ')
                    if len(block['text']) > 300:
                        preview += '...'
                    print(f'  │    [{label}]')
                    print(wrap_text(preview, width=W-4, indent='  │      '))

            # TOOL CALLS
            if turn['tool_calls']:
                print(f'  │')
                print(f'  ├─ TOOLS  ({len(turn["tool_calls"])} call(s))')
                for tc in turn['tool_calls']:
                    sub = f'  [{tc["sub_calls"]} nested calls]' if tc['is_subagent'] and tc['sub_calls'] else ''
                    print(f'  │    [{tc["tool_id"]}]  {tc["label"]}{sub}')

            # FILE EDITS
            if turn['file_edits']:
                print(f'  │')
                print(f'  ├─ FILE EDITS  ({len(turn["file_edits"])} file(s))')
                for p in turn['file_edits']:
                    # Show path relative to a common prefix if possible
                    short = p.replace('\\', '/').split('/Projects/')[-1]
                    print(f'  │    {short}')

            # RESPONSE
            print(f'  │')
            resp = turn['response_text'].strip()
            usage = turn['usage']
            if resp:
                print(f'  ├─ RESPONSE  ({len(resp):,} chars)')
                # Print the full response, indented
                for line in resp.splitlines():
                    print(f'  │    {line}')
            else:
                print(f'  ├─ RESPONSE  (none)')

            # TOKEN USAGE
            if usage:
                pt = usage.get('prompt_tokens', 0)
                ct = usage.get('completion_tokens', 0)
                breakdown = turn['prompt_token_breakdown']
                bk_str = ''
                if breakdown:
                    parts = [f'{b["label"]}: {b.get("percentageOfPrompt", 0)}%' for b in breakdown]
                    bk_str = '  →  ' + ' | '.join(parts)
                print(f'  │')
                print(f'  └─ TOKENS   prompt={fmt_tokens(pt)}{bk_str}')
                print(f'              completion={fmt_tokens(ct)}   total={fmt_tokens(pt+ct)}')
            else:
                print(f'  └──')

        print()

    print(DIVIDER)
    print('END OF SESSIONS')
    print(DIVIDER)


if __name__ == '__main__':
    main()
