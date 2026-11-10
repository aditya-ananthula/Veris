"""Real storage/API regressions; provider replies are isolated test fixtures."""
import json
import io
import zipfile
import uuid
import numpy as np
from fastapi.testclient import TestClient
import api
import config
import intel_store
import intel_extract
import intel_contradict
import rag_core

def upload(client, sid, name='source.txt', text='Acme uses Python to process documents.'):
    response = client.post('/absorb', data={'session_id': sid}, files={'file': (name, text.encode())})
    assert response.status_code == 200, response.text
    return client.get('/intel/documents', params={'session_id': sid}).json()[0]

def test_original_source_and_real_sizes_survive_reopen():
    c, sid = TestClient(api.app), str(uuid.uuid4())
    doc = upload(c, sid)
    assert doc['size_bytes'] == len(b'Acme uses Python to process documents.')
    assert doc['source_available'] and doc['created_at'] > 0
    intel_store.init_db()
    source = c.get('/intel/source/'+doc['doc_id'], params={'session_id':sid})
    assert source.content == b'Acme uses Python to process documents.'
    assert c.get('/intel/source/'+doc['doc_id'], params={'session_id':str(uuid.uuid4())}).status_code == 404

def test_empty_upload_does_not_replace_indexed_source():
    c, sid = TestClient(api.app), str(uuid.uuid4())
    doc = upload(c,sid)
    response=c.post('/absorb',data={'session_id':sid},files={'file':('source.txt',b'   ')})
    assert response.status_code == 400
    assert c.get('/intel/documents',params={'session_id':sid}).json()[0]['doc_id'] == doc['doc_id']
    assert rag_core.list_documents(sid) == ['source.txt']

def test_embedding_failure_keeps_old_version(monkeypatch):
    c,sid=TestClient(api.app),str(uuid.uuid4())
    old=upload(c,sid)
    from chromadb.api.models.Collection import Collection
    monkeypatch.setattr(Collection,'upsert',lambda *a,**k: (_ for _ in ()).throw(RuntimeError('embedding failure')))
    result=c.post('/absorb',data={'session_id':sid},files={'file':('source.txt',b'Changed document')})
    assert result.status_code == 422
    assert intel_store.get_document(old['doc_id'])['status'] == 'indexed'
    assert rag_core.list_documents(sid) == ['source.txt']

def test_projection_uses_embeddings_and_stable_ids():
    c,sid=TestClient(api.app),str(uuid.uuid4())
    upload(c,sid)
    first=c.get('/intel/chunk-projection',params={'session_id':sid}).json()
    second=c.get('/intel/chunk-projection',params={'session_id':sid}).json()
    assert first==second
    assert first['total']==len(first['chunks'])==rag_core._get_collection(sid).count()
    assert all(len(row['projection'])==2 and np.isfinite(row['projection']).all() for row in first['chunks'])
    assert len({row['id'] for row in first['chunks']})==first['total']
    assert all(row['page'] is None for row in first['chunks'])

def test_collection_access_never_expires_other_user_data():
    sid=str(uuid.uuid4());collection=rag_core._get_collection(sid)
    collection.modify(metadata={'last_accessed':1.0})
    rag_core._get_collection(str(uuid.uuid4()))
    assert rag_core.get_chroma_client().get_collection('session_'+sid)

def test_citations_resolve_and_followups_retain_context(monkeypatch):
    c,sid=TestClient(api.app),str(uuid.uuid4());doc=upload(c,sid)
    calls=[]
    def chat(messages):
        calls.append(messages)
        return 'VERDICT: SUPPORTED' if 'ANSWER TO CHECK:' in messages[-1]['content'] else 'Acme uses Python [1].'
    monkeypatch.setattr(rag_core,'_chat',chat)
    history=[{'role':'user','content':'What does Acme use?'}]
    response=c.post('/ask',json={'session_id':sid,'question':'What does it process?','doc_id':doc['doc_id'],'history':history})
    assert response.status_code==200
    assert history[0] in calls[0]
    citations=response.json()['citations']
    stored=rag_core._get_collection(sid).get(include=['documents'])
    assert citations
    for source in citations:
        assert source['doc_id']==doc['doc_id']
        assert stored['documents'][stored['ids'].index(source['chunk_id'])]==source['excerpt']

def test_delete_cleans_sources_entities_relationships_and_contradictions():
    c,sid=TestClient(api.app),str(uuid.uuid4());a=upload(c,sid,'a.txt');b=upload(c,sid,'b.txt')
    entity=intel_store.upsert_entity(sid,'Acme','org')
    for d,value in [(a,'5'),(b,'8')]:
        intel_store.save_facts(sid,d['doc_id'],[{'subject':'Acme','attribute':'count','value':value,'value_type':'number','entity_id':entity,'evidence':'Count '+value}])
    intel_contradict.scan_contradictions(sid)
    assert intel_contradict.list_contradictions(sid)
    assert c.delete('/documents/a.txt',params={'session_id':sid}).status_code==200
    assert not intel_contradict.list_contradictions(sid)
    assert intel_store.list_entities(sid) # still referenced by b
    assert c.delete('/documents/b.txt',params={'session_id':sid}).status_code==200
    assert not intel_store.list_entities(sid)
    assert not intel_store.list_relationships(sid)
    assert not intel_store.get_source(sid,a['doc_id'])
    assert rag_core._get_collection(sid).count()==0

def test_nonverbatim_relationships_are_not_asserted():
    sid=str(uuid.uuid4());doc=intel_store.upsert_document(sid,'source.txt','.txt','hash',1)
    raw=json.dumps({'entities':[{'name':'Acme','entity_type':'org'},{'name':'Python','entity_type':'product'}], 'facts':[], 'relationships':[{'src':'Acme','dst':'Python','rel_type':'owns','evidence':'Invented ownership.'}]})
    intel_extract.run_extraction(sid,doc,'source.txt','Acme uses Python.',llm_caller=lambda _: (raw,None))
    assert intel_store.list_relationships(sid)==[]

def test_comparison_rejects_same_document_and_other_collection():
    c,sid=TestClient(api.app),str(uuid.uuid4());doc=upload(c,sid)
    for other,expected in [(doc['doc_id'],400),('missing',404)]:
        assert c.post('/intel/compare-documents',json={'session_id':sid,'doc_a':doc['doc_id'],'doc_b':other}).status_code==expected


def test_missing_legacy_index_is_visible_without_mutating_registry():
    c, sid = TestClient(api.app), str(uuid.uuid4())
    doc = intel_store.upsert_document(sid, 'legacy.txt', '.txt', 'old', 42)
    response = c.get('/intel/documents', params={'session_id': sid}).json()[0]
    assert response['index_available'] is False
    assert response['chunks'] == 0 and response['recorded_chunks'] == 42
    assert c.get('/intel/stats', params={'session_id': sid}).json()['chunks'] == 0
    assert intel_store.get_document(doc)['chunks'] == 42


def test_replacement_prunes_only_entities_without_remaining_provenance():
    sid = str(uuid.uuid4())
    old = intel_store.upsert_document(sid, 'versioned.txt', '.txt', 'old', 2)
    other = intel_store.upsert_document(sid, 'other.txt', '.txt', 'other', 2)
    stale = intel_store.upsert_entity(sid, 'Old topic')
    kept = intel_store.upsert_entity(sid, 'Shared topic')
    for doc, entity in [(old, stale), (other, kept)]:
        intel_store.save_facts(sid, doc, [{'subject':'Topic', 'attribute':'value', 'value':'yes', 'entity_id':entity}])
    new = intel_store.upsert_document(sid, 'versioned.txt', '.txt', 'new', 2)
    intel_store.supersede_older_versions(sid, 'versioned.txt', new)
    assert {e['entity_id'] for e in intel_store.list_entities(sid)} == {kept}


def test_pdf_pages_and_original_bytes_are_preserved():
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    writer = PdfWriter()
    for text in ['Alpha is on the first page.', 'Beta is on the second page.']:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
        stream = DecodedStreamObject()
        stream.set_data(('BT /F1 12 Tf 72 720 Td (' + text + ') Tj ET').encode())
        page[NameObject('/Contents')] = writer._add_object(stream)
    buffer = io.BytesIO()
    writer.write(buffer)
    content = buffer.getvalue()
    client, sid = TestClient(api.app), str(uuid.uuid4())
    assert client.post('/absorb', data={'session_id': sid}, files={'file': ('pages.pdf', content)}).status_code == 200
    chunks = client.get('/intel/chunks', params={'session_id': sid, 'include_embeddings': False}).json()['chunks']
    passages = [c for c in chunks if c['kind'] == 'passage']
    assert {c['page'] for c in passages} == {1, 2}
    assert all(('Alpha' in c['text']) == (c['page'] == 1) for c in passages)
    source = client.get('/intel/source/' + passages[0]['docId'], params={'session_id': sid})
    assert source.content == content and source.headers['content-type'] == 'application/pdf'


def test_docx_ingestion_uses_actual_paragraph_text():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Acme uses Python.</w:t></w:r></w:p></w:body></w:document>')
    client, sid = TestClient(api.app), str(uuid.uuid4())
    assert client.post('/absorb', data={'session_id': sid}, files={'file': ('source.docx', buffer.getvalue())}).status_code == 200
    chunks = client.get('/intel/chunks', params={'session_id': sid, 'include_embeddings': False}).json()['chunks']
    assert any(c['text'] == 'Acme uses Python.' for c in chunks)
    assert all(c['page'] is None for c in chunks)
