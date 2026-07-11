import { LocalConversationRepository } from "@/adapters/local/conversation-repository";
import { FixtureModelGateway } from "@/adapters/local/fixture-model-gateway";
import { LocalKnowledgeIndex } from "@/adapters/local/knowledge-index";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import { LocalSourceRepository } from "@/adapters/local/source-repository";
import { AssistantService } from "@/services/assistant-service";
import { ConversationService } from "@/services/conversation-service";
import { MemoryService } from "@/services/memory-service";
import { SopService } from "@/services/sop-service";

const conversationRepository = new LocalConversationRepository();
const memoryRepository = new LocalMemoryRepository();
const knowledgeIndex = new LocalKnowledgeIndex();
const modelGateway = new FixtureModelGateway();
const sourceRepository = new LocalSourceRepository();

export const conversationService = new ConversationService(
  conversationRepository,
  memoryRepository,
  knowledgeIndex,
  modelGateway,
  sourceRepository,
);
export const memoryService = new MemoryService(memoryRepository, knowledgeIndex);
export const assistantService = new AssistantService(knowledgeIndex);
export const sopService = new SopService(knowledgeIndex, modelGateway, memoryRepository);
