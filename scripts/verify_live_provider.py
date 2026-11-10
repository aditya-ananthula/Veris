"""Opt-in live NVIDIA workflow using synthetic text and isolated storage only."""
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
directory = Path(tempfile.mkdtemp(prefix='live-provider-', dir=ROOT / 'data/test-runs'))
os.environ['VERIS_SQLITE_PATH'] = str(directory / 'verification.db')
os.environ['VERIS_CHROMA_DIR'] = str(directory / 'vectors')
os.environ['VERIS_EXTRACTION_ENABLED'] = 'on'

import api
import intel_store
import rag_core
from fastapi.testclient import TestClient

client = TestClient(api.app)
session = str(uuid4())
started = time.monotonic()
report = {'synthetic_source_only': True, 'provider': 'NVIDIA', 'model': rag_core.NVIDIA_MODEL}
try:
    source = b'Veris Verification Lab uses Python for document processing. The lab processes 42 documents per day. Its verification code is violet-42.'
    upload = client.post('/absorb', data={'session_id': session}, files={'file': ('verification.txt', source, 'text/plain')})
    report['upload_status'] = upload.status_code
    upload.raise_for_status()
    doc = client.get('/intel/documents', params={'session_id': session}).json()[0]
    report['extraction_status'] = doc['extraction_status']
    report['validated_facts'] = len([f for f in intel_store.search_facts(session) if f['status'] == 'validated'])
    answer = client.post('/ask', json={'session_id': session, 'doc_id': doc['doc_id'], 'question': 'What is the verification code of Veris Verification Lab?'})
    report['answer_status'] = answer.status_code
    answer.raise_for_status()
    result = answer.json()
    chunks = {c['id']: c['text'] for c in client.get('/intel/chunks', params={'session_id': session, 'include_embeddings': False}).json()['chunks']}
    report['correct_answer'] = 'violet-42' in result['answer'].lower()
    report['citation_count'] = len(result['citations'])
    report['citations_exact'] = bool(result['citations']) and all(chunks.get(c['chunk_id']) == c['excerpt'] for c in result['citations'])
    report['validation'] = result['validation'].splitlines()[0]
    report['passed'] = report['correct_answer'] and report['citations_exact'] and doc['extraction_status'] == 'complete'
except Exception as error:
    report['passed'] = False
    report['error_type'] = type(error).__name__
finally:
    report['elapsed_seconds'] = round(time.monotonic() - started, 2)
    (ROOT / 'docs/verification/rebuild/live-workflow.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
sys.exit(0 if report['passed'] else 1)
