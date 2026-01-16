# Multi AI Agent Architecture - IFM Syntax Pro

## Tổng Quan

Kiến trúc Multi AI Agent được thiết kế để tự động hóa toàn bộ workflow của IFM Syntax Pro, từ việc parse PDF survey đến generate final SPSS syntax. Mỗi agent chuyên biệt cho một task cụ thể, được orchestrate bởi một Master Agent để đảm bảo workflow mượt mà và chính xác.

## Workflow Hiện Tại

```
PDF Upload → Parse Questions → Variable Mapping → Label Refinery → 
Questions Management → QC Logic Generation → Processing → Syntax Generation
```

## Kiến Trúc Đề Xuất

### 1. Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    Master Orchestrator                       │
│  - Quản lý workflow tổng thể                                │
│  - Điều phối các agents                                      │
│  - Xử lý errors và retries                                  │
│  - State management                                          │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼────────┐  ┌──────▼────────┐
│  Parsing Agent │  │  Refinement    │  │  Generation    │
│                │  │  Agent Group   │  │  Agent Group   │
└────────────────┘  └────────────────┘  └────────────────┘
```

### 2. Agent Specifications

#### 2.1 Master Orchestrator Agent
**Trách nhiệm:**
- Quản lý workflow pipeline
- Điều phối các agents theo thứ tự
- Xử lý dependencies giữa các agents
- Error handling và recovery
- Progress tracking
- State persistence

**Input:** Project context, User requirements
**Output:** Complete processed project với syntax files

**Key Features:**
- Workflow state machine
- Agent communication protocol
- Retry logic với exponential backoff
- Checkpoint system để resume từ lỗi

#### 2.2 PDF Parsing Agent
**Trách nhiệm:**
- Extract text từ PDF survey
- Parse questions, options, logic
- Validate JSON structure
- Handle complex layouts (tables, grids)

**Model:** Gemini 2.5 Flash (hiện tại)
**Input:** PDF file
**Output:** ParsedQuestion[] JSON

**Specializations:**
- **Question Type Classifier:** Xác định SA, MA, Grid, Rank, OE
- **Logic Extractor:** Extract Ask All, Piping, Terminate conditions
- **Structure Validator:** Validate JSON format và completeness

**Improvements:**
- Multi-pass parsing cho complex surveys
- Confidence scoring cho mỗi parsed question
- Auto-correction suggestions

#### 2.3 Variable Mapping Agent
**Trách nhiệm:**
- Map old variable names → new variable names
- Suggest optimal variable naming
- Validate variable name conflicts
- Generate variable mapping table

**Model:** Gemini (hoặc fine-tuned model)
**Input:** Parsed questions, Old variable list (optional)
**Output:** Variable mapping dictionary

**Specializations:**
- **Naming Convention Agent:** Đề xuất naming theo IFM standards
- **Conflict Resolver:** Detect và resolve naming conflicts
- **Validation Agent:** Validate mapping completeness

#### 2.4 Label Refinement Agent
**Trách nhiệm:**
- Clean và standardize labels
- Remove English text, keep Vietnamese only
- Fix typos và formatting
- Suggest improvements

**Model:** Gemini (text refinement)
**Input:** Raw labels
**Output:** Cleaned labels

**Specializations:**
- **Language Detector:** Detect và separate Vietnamese/English
- **Cleaner Agent:** Remove artifacts, fix formatting
- **Quality Checker:** Validate label quality

#### 2.5 Logic Analysis Agent
**Trách nhiệm:**
- Analyze question dependencies
- Build logic graph
- Validate logic consistency
- Generate QC logic syntax

**Model:** Gemini (reasoning)
**Input:** Parsed questions
**Output:** QC Logic Graph, QC Syntax

**Specializations:**
- **Dependency Analyzer:** Build dependency graph
- **Logic Validator:** Check for circular dependencies, conflicts
- **Syntax Generator:** Generate QC CHECK statements

#### 2.6 Syntax Generation Agent
**Trách nhiệm:**
- Generate SPSS syntax cho từng question type
- Format syntax theo IFM standards
- Validate syntax correctness
- Generate complete syntax file

**Model:** Rule-based + AI validation
**Input:** Processed questions, Variable mapping
**Output:** SPSS syntax files

**Specializations:**
- **SA Syntax Generator:** Single Answer syntax
- **MA Syntax Generator:** Multiple Answer syntax
- **Grid Syntax Generator:** Grid/Matrix syntax
- **Rank Syntax Generator:** Ranking syntax
- **Syntax Validator:** Validate syntax before output

#### 2.7 Processing Agent Group
**Trách nhiệm:**
- Handle various SPSS processing operations
- Generate processing syntax

**Sub-agents:**
- **Coding Agent:** Generate coding syntax
- **Netcode Agent:** Generate netcode syntax
- **Recode Agent:** Generate recode syntax
- **Restruct Agent:** Generate restructure syntax
- **Topbox Agent:** Generate topbox syntax
- **Rerank Agent:** Generate rerank syntax
- **Reloop Agent:** Generate reloop syntax

## 3. Communication Protocol

### 3.1 Message Format

```typescript
interface AgentMessage {
  from: string // Agent ID
  to: string // Target Agent ID or 'orchestrator'
  type: 'request' | 'response' | 'error' | 'progress'
  taskId: string // Unique task identifier
  payload: any // Task-specific data
  metadata: {
    timestamp: number
    retryCount?: number
    dependencies?: string[] // Task IDs this depends on
  }
}
```

### 3.2 Agent Communication Patterns

**Request-Response:**
```
Agent A → Orchestrator: Request task
Orchestrator → Agent B: Assign task
Agent B → Orchestrator: Task complete
Orchestrator → Agent A: Response with result
```

**Pub-Sub (for progress updates):**
```
Agent → Event Bus: Progress update
All subscribers → Receive update
```

**Pipeline:**
```
PDF → Parsing Agent → Refinement Agent → Mapping Agent → ...
```

## 4. State Management

### 4.1 Project State

```typescript
interface ProjectState {
  id: string
  currentStep: WorkflowStep
  data: {
    rawPDF?: File
    parsedQuestions?: ParsedQuestion[]
    variableMapping?: OldVariableMapping
    cleanedLabels?: Record<string, string>
    qcLogicGraph?: QCLogicGraph
    syntaxFiles?: {
      rename?: string
      varLab?: string
      valLab?: string
      recode?: string
      qcLogic?: string
    }
  }
  agentStates: {
    [agentId: string]: AgentState
  }
  errors: AgentError[]
  checkpoints: Checkpoint[]
}
```

### 4.2 Checkpoint System

- Save state sau mỗi major step
- Cho phép resume từ checkpoint khi có lỗi
- Support partial re-processing

## 5. Error Handling & Recovery

### 5.1 Error Types

- **Transient Errors:** Network, rate limits → Retry với backoff
- **Validation Errors:** Invalid data → Request user input
- **Agent Errors:** Agent failure → Fallback agent hoặc manual intervention

### 5.2 Recovery Strategies

1. **Automatic Retry:** Cho transient errors
2. **Fallback Agent:** Nếu agent chính fail, dùng backup
3. **Partial Recovery:** Resume từ checkpoint
4. **Human-in-the-loop:** Request user input khi cần

## 6. Implementation Architecture

### 6.1 Technology Stack

**Backend:**
- **Orchestrator:** Node.js/Next.js API Routes
- **Agent Framework:** LangChain hoặc tự build
- **Message Queue:** Redis hoặc in-memory queue
- **State Store:** Redis + PostgreSQL (cho persistence)

**AI Models:**
- **Primary:** Gemini 2.5 Flash (parsing, refinement)
- **Secondary:** GPT-4 hoặc Claude (complex reasoning)
- **Fine-tuned:** Custom model cho syntax generation (optional)

**Frontend:**
- **Agent Dashboard:** Monitor agent status
- **Progress Visualization:** Real-time progress
- **Error Handling UI:** User intervention khi cần

### 6.2 Agent Implementation Pattern

```typescript
abstract class BaseAgent {
  abstract agentId: string
  abstract execute(task: AgentTask): Promise<AgentResult>
  
  protected async callAI(prompt: string, context: any): Promise<any> {
    // AI call logic với retry
  }
  
  protected validate(result: any): boolean {
    // Validation logic
  }
  
  protected reportProgress(progress: number): void {
    // Report to orchestrator
  }
}

class ParsingAgent extends BaseAgent {
  agentId = 'parsing-agent'
  
  async execute(task: PDFParsingTask): Promise<ParsingResult> {
    // Parse PDF logic
  }
}
```

## 7. Workflow Orchestration

### 7.1 Sequential Workflow

```
1. PDF Upload → Parsing Agent
2. Parsing Complete → Refinement Agent
3. Refinement Complete → Variable Mapping Agent
4. Mapping Complete → Logic Analysis Agent
5. Logic Complete → Syntax Generation Agent
6. Syntax Complete → Processing Agents (parallel)
7. All Complete → Final Assembly
```

### 7.2 Parallel Processing

Một số agents có thể chạy song song:
- Label Refinement (cho từng question)
- Processing operations (coding, netcode, etc.)

### 7.3 Conditional Workflow

- Nếu có old variables → Run Variable Mapping Agent
- Nếu không có → Skip mapping step
- Nếu có errors → Run Validation Agent

## 8. Performance Optimization

### 8.1 Caching Strategy

- Cache parsed results cho cùng PDF
- Cache AI responses cho similar questions
- Cache variable mappings

### 8.2 Batch Processing

- Batch similar questions để reduce API calls
- Parallel processing cho independent tasks

### 8.3 Model Selection

- Fast model (Gemini Flash) cho simple tasks
- Powerful model (GPT-4) cho complex reasoning
- Rule-based cho deterministic tasks

## 9. Monitoring & Observability

### 9.1 Metrics

- Agent execution time
- Success/failure rates
- API call counts và costs
- User satisfaction scores

### 9.2 Logging

- Structured logging cho mỗi agent
- Error tracking và alerting
- Performance profiling

### 9.3 Dashboard

- Real-time agent status
- Workflow visualization
- Error monitoring
- Cost tracking

## 10. Security & Privacy

### 10.1 Data Handling

- Encrypt sensitive data
- Secure API keys
- Data retention policies

### 10.2 Access Control

- User authentication
- Project-level permissions
- Audit logging

## 11. Scalability Considerations

### 11.1 Horizontal Scaling

- Stateless agents → Easy to scale
- Load balancing cho AI API calls
- Queue-based processing

### 11.2 Resource Management

- Rate limiting per agent
- Priority queues
- Resource pooling

## 12. Migration Path

### Phase 1: Foundation (Weeks 1-2)
- Implement Master Orchestrator
- Create base agent framework
- Migrate PDF Parsing Agent

### Phase 2: Core Agents (Weeks 3-4)
- Variable Mapping Agent
- Label Refinement Agent
- Logic Analysis Agent

### Phase 3: Generation Agents (Weeks 5-6)
- Syntax Generation Agent
- Processing Agents

### Phase 4: Enhancement (Weeks 7-8)
- Error handling improvements
- Performance optimization
- Monitoring dashboard

## 13. Example Workflow Execution

```
User uploads PDF
  ↓
Master Orchestrator creates project
  ↓
Parsing Agent processes PDF
  → Progress: 0-100%
  → Result: ParsedQuestion[]
  ↓
Refinement Agent cleans labels
  → Processes each question in parallel
  → Result: Cleaned questions
  ↓
Variable Mapping Agent (if needed)
  → Analyzes old variables
  → Generates mapping
  ↓
Logic Analysis Agent
  → Builds dependency graph
  → Generates QC logic
  ↓
Syntax Generation Agent
  → Generates all syntax files
  ↓
Processing Agents (parallel)
  → Coding, Netcode, Recode, etc.
  ↓
Master Orchestrator assembles final output
  → Returns complete project
```

## 14. Benefits

1. **Modularity:** Mỗi agent độc lập, dễ maintain
2. **Scalability:** Dễ scale từng agent riêng
3. **Reliability:** Error isolation, recovery mechanisms
4. **Flexibility:** Dễ thêm agents mới
5. **Observability:** Full visibility vào workflow
6. **Performance:** Parallel processing, caching

## 15. Challenges & Solutions

### Challenge 1: Agent Coordination
**Solution:** Centralized orchestrator với clear communication protocol

### Challenge 2: Error Propagation
**Solution:** Error boundaries, checkpoint system

### Challenge 3: Cost Management
**Solution:** Model selection, caching, batch processing

### Challenge 4: State Consistency
**Solution:** Immutable state updates, transaction-like operations

## 16. Future Enhancements

1. **Learning Agent:** Learn từ user corrections
2. **Auto-optimization:** Tự động optimize workflow
3. **Multi-model Ensemble:** Combine multiple models cho accuracy
4. **Real-time Collaboration:** Multiple users working cùng project
5. **Version Control:** Track changes và rollback

---

**Tác giả:** AI Assistant  
**Ngày:** 2025-01-29  
**Version:** 1.0
