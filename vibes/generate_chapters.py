#!/usr/bin/env python3
"""
Generate vibes chapter markdown files from VSCode Copilot Chat JSONL session logs.
Uses parse_sessions.py's robust JSONL parser (with i_val truncation support).
Extracts full response text, thinking blocks with titles, rich tool call labels,
file edits, and token usage from the actual session data.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_sessions import parse_jsonl, extract_turns

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SESSIONS_DIR_1 = os.path.join(BASE_DIR, r"coverage\bf748491efd995d8c8e900dafa0ca87a\chatSessions")
SESSIONS_DIR_2 = os.path.join(BASE_DIR, r"coverage\02d3c7cfaec983e3ff6cba9fc7b21a34\chatSessions")


# ---------------------------------------------------------------------------
# Chapter definitions — preserving headers, commit lists, and structure
# ---------------------------------------------------------------------------

CHAPTERS = [
    {
        'num': 1,
        'filename': '01-initial-commit.md',
        'title': 'Initial Commit & Project Setup',
        'subtitle': 'Tech stack analysis and bootstrapping the React app',
        'commits': [
            ('af53ed6', 'initial commit'),
            ('eb26b14', 'good vibes'),
        ],
        'sessions': ['22df10d7-8d38-420b-88dd-ca7cdf5cf2e5'],
    },
    {
        'num': 2,
        'filename': '02-split-panes.md',
        'title': 'Split Panes & Core Layout',
        'subtitle': 'Building the XSD editor with tree view and property sheet',
        'commits': [
            ('8c92e75', 'supports split panes'),
            ('d1a7e11', 'supports initial sample xsd'),
        ],
        'sessions': ['42122b35-1c05-4b9e-a7e4-cfd919336bab'],
    },
    {
        'num': 3,
        'filename': '03-xsd-features.md',
        'title': 'XSD Features & Schema Editing',
        'subtitle': 'Adding datatypes, namespace editing, elementFormDefault, unbounded, hints and more',
        'commits': [
            ('2cfd6cc', 'supports builtin W3C datatypes'),
            ('7a7b645', 'supports elementFormDefault <xs:schema /> property'),
            ('624d6c1', 'supports renaming namespace'),
            ('beebf23', "supports special 'unbounded' value"),
            ('4e0c0e2', 'displays min\u2026max hints in the tree view'),
            ('d5bf79e', 'supports creating and reordering nodes'),
            ('63daa5b', "supports attributes' use 'Required' or 'Optional'"),
        ],
        'sessions': [
            'be942830-0402-4a89-af0b-49d1241d94d4',
            '155d980a-7a71-4f08-9328-7493ab15d01f',
        ],
    },
    {
        'num': 4,
        'filename': '04-code-quality.md',
        'title': 'Code Quality & Best Practices',
        'subtitle': 'Biome formatting/linting, architecture documentation, and violation scanning',
        'commits': [
            ('37cff66', 'biome: formats and lints code'),
            ('beb317d', 'biome: applied suggested (unsafe) fixes'),
            ('4daae06', 'documented architecture for the solution'),
        ],
        'sessions': [
            '73304b43-8ff0-4725-b458-6f9686e2d733',
        ],
    },
    {
        'num': 5,
        'filename': '05-unit-testing.md',
        'title': 'Unit Testing',
        'subtitle': 'Comprehensive test suite for store, parser, serializer, and types',
        'commits': [
            ('bc4a183', 'unit testing before addressing violations'),
        ],
        'sessions': ['6015431f-de63-47a5-8804-ff073d97a423'],
    },
    {
        'num': 6,
        'filename': '06-fixing-violations.md',
        'title': 'Fixing Violations to Best Practices',
        'subtitle': 'Addressing code quality violations identified by the AI agent',
        'commits': [
            ('a5d5103', 'fixed most violations to best practices'),
        ],
        'sessions': ['b670ae15-63e1-498e-8622-8f579bd0b87f'],
    },
    {
        'num': 7,
        'filename': '07-benchmarks.md',
        'title': 'Benchmark Testing & Performance',
        'subtitle': 'Creating benchmark infrastructure and addressing performance improvements',
        'commits': [
            ('febaf5e', 'creates benchmark test harness'),
            ('c22de10', 'addressed performance improvement suggestions'),
        ],
        'sessions': [
            '4187b326-954a-4fad-89b3-da5ba7f077e8',
            'eed51808-5bf3-477b-ba4d-df5210335cf1',
        ],
    },
]


# ---------------------------------------------------------------------------
# Session loading
# ---------------------------------------------------------------------------

def load_all_sessions():
    """Load all sessions, returning both parsed turns and raw request data."""
    all_sessions = {}
    for d in [SESSIONS_DIR_1, SESSIONS_DIR_2]:
        if not os.path.exists(d):
            continue
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

            session_id = session.get('sessionId', fname.replace('.jsonl', ''))
            raw_requests = session.get('requests', [])

            all_sessions[session_id] = {
                'session': session,
                'turns': turns,
                'raw_requests': raw_requests,
                'file': fname,
                'creation_date': session.get('creationDate'),
            }
    return all_sessions


def get_tool_round_count(req):
    """Get the tool round count from request metadata, falling back to heuristic."""
    result = req.get('result') or {}
    metadata = result.get('metadata') or {}
    if isinstance(metadata, dict):
        tcr = metadata.get('toolCallRounds')
        if isinstance(tcr, list):
            return len(tcr)

    # Fallback: count from response items
    response = req.get('response', [])
    rounds = 0
    in_tool = False
    seen = set()
    for item in response:
        if not isinstance(item, dict):
            continue
        kind = item.get('kind')
        sub_id = item.get('subAgentInvocationId')
        if kind == 'toolInvocationSerialized' and not sub_id:
            call_id = item.get('toolCallId', '')
            if call_id and call_id in seen:
                continue
            if call_id:
                seen.add(call_id)
            if not in_tool:
                rounds += 1
                in_tool = True
        elif kind == 'thinking':
            in_tool = False
    return rounds


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def format_ts(ts):
    if ts:
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    return 'unknown'


def format_duration(ms):
    if not ms:
        return 'unknown'
    seconds = ms / 1000
    if seconds < 60:
        return f"{seconds:.0f}s"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}m {secs}s"


def format_number(n):
    """Format a number with narrow no-break space as thousands separator."""
    return f'{n:,}'.replace(',', '\u202f')


def shorten_path(path):
    if not path:
        return path
    path = path.replace('\\', '/')
    for prefix in ['/c:/Projects/springcomp/fred/', '/C:/Projects/springcomp/fred/',
                   'c:/Projects/springcomp/fred/', 'C:/Projects/springcomp/fred/',
                   '/c:/Projects/springcomp/ffed/', '/C:/Projects/springcomp/ffed/',
                   'c:/Projects/springcomp/ffed/', 'C:/Projects/springcomp/ffed/']:
        if path.startswith(prefix):
            path = path[len(prefix):]
            break
    if path.startswith('/'):
        path = path[1:]
    return path


def downgrade_headers(text):
    """Downgrade markdown headers so they don't conflict with document structure.
    # → #####, ## → ######, deeper → bold text."""
    if not text:
        return text

    def header_replacer(m):
        hashes = m.group(1)
        title = m.group(2)
        new_level = len(hashes) + 4
        if new_level <= 6:
            return '#' * new_level + ' ' + title
        else:
            return f'**{title}**'
    return re.sub(r'^(#{1,6})\s+(.+)$', header_replacer, text, flags=re.MULTILINE)


def clean_empty_code_fences(text):
    """Remove empty code fence pairs (``` immediately followed by ```)."""
    if not text:
        return text
    # Remove empty fenced blocks: opening fence, optional whitespace, closing fence
    cleaned = re.sub(r'```\w*\s*\n\s*```', '', text)
    # Clean up excessive blank lines left behind
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


def balance_code_fences(text):
    """Ensure code fences are balanced."""
    if not text:
        return text
    lines = text.split('\n')
    result = []
    in_fence = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('```'):
            if not in_fence:
                in_fence = True
            else:
                in_fence = False
            result.append(line)
        else:
            result.append(line)
    if in_fence:
        result.append('```')
    return '\n'.join(result)


def format_response_summary(response_text, files_edited):
    """Create a formatted summary of the agent response for the <details> block."""
    parts = []

    if files_edited:
        short_files = [shorten_path(f) for f in files_edited]
        parts.append('**Files modified:**')
        for f in short_files:
            parts.append(f'- `{f}`')
        parts.append('')

    if response_text:
        cleaned = clean_empty_code_fences(response_text.strip())
        cleaned = balance_code_fences(cleaned)
        cleaned = downgrade_headers(cleaned)
        if cleaned:
            parts.append(cleaned)
    elif not files_edited:
        parts.append("The agent processed the request (response captured in tool calls only).")

    return '\n'.join(parts)


def format_tool_call_summary(tool_calls):
    """Format tool calls as a compact summary: `tool_a` ×N, `tool_b`, ..."""
    if not tool_calls:
        return ''
    counts = {}
    for tc in tool_calls:
        tid = tc['tool_id']
        counts[tid] = counts.get(tid, 0) + 1
    parts = []
    for tid, count in counts.items():
        if count > 1:
            parts.append(f'`{tid}` \u00d7{count}')
        else:
            parts.append(f'`{tid}`')
    return ', '.join(parts)


def format_tool_call_details(tool_calls):
    """Format detailed tool call list with labels for the chain-of-thought section."""
    lines = []
    for tc in tool_calls:
        sub_info = ''
        if tc['is_subagent'] and tc['sub_calls']:
            sub_info = f'  [{tc["sub_calls"]} nested calls]'
        label = tc['label']
        # Truncate very long labels
        if len(label) > 200:
            label = label[:200] + '...'
        lines.append(f'- `{tc["tool_id"]}`: {label}{sub_info}')
    return '\n'.join(lines)


def format_thinking(thinking_blocks, encrypted_present=False):
    """Format the chain-of-thought content from thinking blocks."""
    if not thinking_blocks:
        if encrypted_present:
            return "*Chain-of-thought is encrypted (Anthropic's standard practice). Cannot be decrypted.*"
        return "*No chain-of-thought content captured for this turn.*"

    parts = []
    has_encrypted = False

    for i, block in enumerate(thinking_blocks):
        text = block.get('text', '').strip()
        title = block.get('title', '').strip()

        if not text:
            has_encrypted = True
            continue

        if len(thinking_blocks) > 1:
            label = title if title else f'Round {i + 1}'
            parts.append(f'**{label}:**')

        # Downgrade headers and balance code fences
        cleaned = downgrade_headers(text)
        cleaned = balance_code_fences(cleaned)
        parts.append(cleaned)
        parts.append('')

    result = '\n'.join(parts) if parts else "*No readable chain-of-thought content.*"

    if has_encrypted or encrypted_present:
        result += "\n\n*Note: Some thinking content is encrypted (Anthropic's standard practice).*"

    return result


# ---------------------------------------------------------------------------
# Matching raw requests to parsed turns
# ---------------------------------------------------------------------------

def build_turn_request_map(turns, raw_requests):
    """Map each parsed turn to its corresponding raw request.

    The parse_sessions.py extract_turns skips canceled requests,
    so we need to find matching raw requests by timestamp.
    """
    mapping = []
    canceled_set = set()

    for ri, req in enumerate(raw_requests):
        if not isinstance(req, dict):
            continue
        result = req.get('result') or {}
        error = result.get('errorDetails', {})
        if isinstance(error, dict) and error.get('code') == 'canceled':
            canceled_set.add(ri)

    # Match turns to non-canceled requests by order
    non_canceled = [
        (ri, req) for ri, req in enumerate(raw_requests)
        if isinstance(req, dict) and ri not in canceled_set
    ]

    for ti, turn in enumerate(turns):
        if ti < len(non_canceled):
            mapping.append(non_canceled[ti][1])
        else:
            mapping.append(None)

    return mapping


# ---------------------------------------------------------------------------
# Chapter markdown generation
# ---------------------------------------------------------------------------

def generate_chapter(chapter, all_sessions):
    """Generate complete markdown for a single chapter file."""
    lines = []

    # Header
    lines.append(f"# Chapter {chapter['num']}: {chapter['title']}")
    lines.append('')
    lines.append(f"> {chapter['subtitle']}")
    lines.append('')
    lines.append('## Git Commits')
    lines.append('')
    for sha, msg in chapter['commits']:
        lines.append(f'- `{sha} \u2014 {msg}`')
    lines.append('')
    lines.append('---')
    lines.append('')

    ch_prompt_tokens = 0
    ch_completion_tokens = 0
    ch_total_requests = 0

    for session_id in chapter['sessions']:
        if session_id not in all_sessions:
            lines.append(f'## Session: `{session_id}` (not found)')
            lines.append('')
            continue

        sdata = all_sessions[session_id]
        turns = sdata['turns']
        raw_requests = sdata['raw_requests']
        creation_date = sdata['creation_date']

        # Map turns to raw requests for metadata access
        turn_req_map = build_turn_request_map(turns, raw_requests)

        # Session-level token aggregation
        s_prompt = sum(t['usage'].get('prompt_tokens', 0) for t in turns)
        s_completion = sum(t['usage'].get('completion_tokens', 0) for t in turns)
        s_total = s_prompt + s_completion

        ch_prompt_tokens += s_prompt
        ch_completion_tokens += s_completion
        ch_total_requests += len(turns)

        # Timestamps
        timestamps = [t['timestamp'] for t in turns if t['timestamp']]
        first_ts = min(timestamps) if timestamps else None
        last_ts = max(timestamps) if timestamps else None

        # Model (from first turn)
        model = turns[0]['model'] if turns else 'unknown'

        lines.append(f'## Session: `{session_id}`')
        lines.append('')
        lines.append('| Property | Value |')
        lines.append('|----------|-------|')
        lines.append(f'| **Created** | {format_ts(creation_date)} |')
        lines.append(f'| **Model** | {model} |')
        lines.append(f'| **Requests** | {len(turns)} |')
        if first_ts and last_ts:
            lines.append(f'| **Time span** | {format_ts(first_ts)} \u2192 {format_ts(last_ts)} |')
        lines.append(f'| **Prompt tokens** | {format_number(s_prompt)} |')
        lines.append(f'| **Completion tokens** | {format_number(s_completion)} |')
        lines.append(f'| **Total tokens** | {format_number(s_total)} |')
        lines.append('')

        for ti, turn in enumerate(turns):
            raw_req = turn_req_map[ti] if ti < len(turn_req_map) else None

            prompt = turn['prompt'].strip()
            if not prompt:
                prompt = '*(empty prompt \u2014 likely cancelled)*'

            # Duration
            elapsed = turn['timings'].get('totalElapsed', 0) if turn['timings'] else 0

            # Tool rounds from metadata
            tool_round_count = get_tool_round_count(raw_req) if raw_req else 0

            # Token info
            pt = turn['usage'].get('prompt_tokens', 0)
            ct = turn['usage'].get('completion_tokens', 0)
            token_str = ''
            if pt or ct:
                token_str = f' | **Tokens:** {format_number(pt)} in / {format_number(ct)} out'

            lines.append(f'### Turn {ti + 1}')
            lines.append('')
            lines.append(f'**Timestamp:** {format_ts(turn["timestamp"])} | '
                         f'**Duration:** {format_duration(elapsed)} | '
                         f'**Tool rounds:** {tool_round_count}{token_str}')
            lines.append('')

            # User prompt
            lines.append('**User prompt:**')
            lines.append('')
            for pline in prompt.split('\n'):
                lines.append(f'> {pline}')
            lines.append('')

            # Agent response summary
            response_summary = format_response_summary(
                turn['response_text'], turn['file_edits']
            )
            lines.append('<details>')
            lines.append('<summary>Agent response summary</summary>')
            lines.append('')
            lines.append(response_summary)
            lines.append('')
            lines.append('</details>')
            lines.append('')

            # Chain-of-thought / tool calls
            has_encrypted = any(
                not b.get('text', '').strip() for b in turn['thinking_blocks']
            )
            thinking_content = format_thinking(turn['thinking_blocks'], has_encrypted)

            lines.append('<details>')
            lines.append('<summary>Chain-of-thought / tool calls</summary>')
            lines.append('')

            if tool_round_count > 0:
                lines.append(f'**Tool rounds:** {tool_round_count}')
                lines.append('')

            if turn['tool_calls']:
                tool_summary = format_tool_call_summary(turn['tool_calls'])
                lines.append(f'**Tool calls:** {tool_summary}')
                lines.append('')

            if turn['file_edits']:
                lines.append('**Files modified:**')
                for f in turn['file_edits']:
                    sf = shorten_path(f)
                    lines.append(f'- `{sf}`')
                lines.append('')

            lines.append('**Thinking:**')
            lines.append('')
            lines.append(thinking_content)
            lines.append('')
            lines.append('</details>')
            lines.append('')
            lines.append('---')
            lines.append('')

    # Chapter Token Summary
    ch_total_tokens = ch_prompt_tokens + ch_completion_tokens
    lines.append('## Chapter Token Summary')
    lines.append('')
    lines.append('| Metric | Value |')
    lines.append('|--------|-------|')
    lines.append(f'| Total requests | {ch_total_requests} |')
    lines.append(f'| Total prompt tokens | {format_number(ch_prompt_tokens)} |')
    lines.append(f'| Total completion tokens | {format_number(ch_completion_tokens)} |')
    lines.append(f'| Total tokens | {format_number(ch_total_tokens)} |')
    lines.append('')

    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    all_sessions = load_all_sessions()

    print(f"Loaded {len(all_sessions)} sessions")
    for sid, sdata in all_sessions.items():
        print(f"  {sid}: {len(sdata['turns'])} turns")

    # Summary
    total_requests = 0
    total_prompt = 0
    total_completion = 0

    for ch in CHAPTERS:
        for sid in ch['sessions']:
            if sid in all_sessions:
                turns = all_sessions[sid]['turns']
                total_requests += len(turns)
                total_prompt += sum(t['usage'].get('prompt_tokens', 0) for t in turns)
                total_completion += sum(t['usage'].get('completion_tokens', 0) for t in turns)

    print(f"\nTotals across chapters:")
    print(f"  Requests: {total_requests}")
    print(f"  Prompt tokens: {format_number(total_prompt)}")
    print(f"  Completion tokens: {format_number(total_completion)}")
    print(f"  Total tokens: {format_number(total_prompt + total_completion)}")

    # Generate chapter files
    for chapter in CHAPTERS:
        content = generate_chapter(chapter, all_sessions)
        outpath = os.path.join(BASE_DIR, 'vibes', chapter['filename'])
        with open(outpath, 'w', encoding='utf-8') as f:
            f.write(content)
        num_lines = content.count('\n') + 1
        print(f"\nWrote {chapter['filename']} ({num_lines} lines, {len(content):,} chars)")


if __name__ == '__main__':
    main()
