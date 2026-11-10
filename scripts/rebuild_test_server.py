"""Isolated local verification: real API/storage/embeddings, test-only LLM."""
import os
import sys
import json
import tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
test_dir = Path(tempfile.mkdtemp(prefix='browser-', dir=ROOT/'data/test-runs'))
os.environ['VERIS_SQLITE_PATH'] = str(test_dir/'test.db')
os.environ['VERIS_CHROMA_DIR'] = str(test_dir/'vectors')
os.environ['VERIS_EXTRACTION_ENABLED'] = 'on'
import api
import rag_core

def test_chat(messages):
    prompt=messages[-1]['content']
    if 'Extract structured knowledge' in prompt:
        value='8' if '8 projects' in prompt else '5'
        evidence=f'Acme uses Python to process {value} projects.'
        return json.dumps({'entities':[{'name':'Acme','entity_type':'org'},{'name':'Python','entity_type':'technology'}],
          'facts':[{'subject':'Acme','attribute':'projects','value':value,'value_type':'number','evidence':evidence,'confidence':.99},
                   {'subject':'Python','attribute':'purpose','value':'document processing','evidence':evidence,'confidence':.99}],
          'relationships':[{'src':'Acme','dst':'Python','rel_type':'uses','evidence':evidence}]})
    if 'ANSWER TO CHECK:' in prompt:
        return 'VERDICT: SUPPORTED\nUNSUPPORTED_CLAIMS: None\nREASONING: Supported by the test source.'
    return 'Acme uses Python to process projects [1].\n\n| Source | Purpose |\n|---|---|\n| Python | Document processing |'
rag_core._chat=test_chat
if __name__=='__main__':
    import uvicorn
    uvicorn.run(api.app,host='127.0.0.1',port=8011)
