import { ChunkCloud } from '../components/charts/ChunkCloud';
import { useKnowledge } from './KnowledgeLayout';
export function ChunkCloudPage() { const {sessionId,revision}=useKnowledge();return <ChunkCloud sessionId={sessionId} revision={revision}/>; }
