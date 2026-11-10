"""Real-document retrieval measurement; no live generation or user collection mutation."""
import os,sys,json,time,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["VERIS_SQLITE_PATH"]=str(ROOT/"docs/verification/latency-test.db")
os.environ["VERIS_CHROMA_DIR"]=""
os.environ["VERIS_EXTRACTION_ENABLED"]="off"
import rag_core
from uuid import uuid4
session=str(uuid4())
count=rag_core.ingest_document(str(ROOT/"resume.pdf"),session,"resume.pdf")
samples=[]
start=0.0
first=True
def generation_stub(messages):
    global first
    if first:
        samples.append((time.perf_counter()-start)*1000)
        first=False
        return "I don't know based on the provided documents."
    return "VERDICT: SUPPORTED"
rag_core._chat=generation_stub
question="What projects and technical skills are listed in the resume?"
for _ in range(11):
    first=True
    start=time.perf_counter()
    rag_core.ask_question(question,session)
report={"document":"resume.pdf","stored_chunks":count,"question":question,"warmup_ms":samples[0],"runs_ms":samples[1:],"median_ms":statistics.median(samples[1:]),"scope":"Warm hybrid retrieval plus context preparation up to first generation call; real Chroma default embeddings and real PDF. Generation replaced with stub and excluded. Single local process; not an improvement percentage."}
(ROOT/"docs/verification/retrieval-latency.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
rag_core.delete_document(session,"resume.pdf")
print(json.dumps(report,indent=2))
