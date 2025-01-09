import { RedisService } from './RedisService.js';
import { TransactionService } from './TransactionService.js';
import { Agent } from '../entities/Agent.entity.js';
import { Task } from '../entities/Task.entity.js';
import { PostgresDataSource } from '../postgresql.config.js';
import { Repository } from 'typeorm';
import { ChatLog } from '../schemas/ChatLog.schema.js';
import { AnalysisResult } from '../schemas/AnalysisResult.schema.js';
import { TwitterService } from '../../../services/social/twitter.js';
import { IAIService } from '../../../services/ai/types.js';
import { Logger } from '../../../utils/logger.js';
import { MarketAction } from '../../../config/constants.js';
import { loadCharacter } from '../../../personality/loadCharacter.js';

export class AgentCoordinationService {
  private static instance: AgentCoordinationService;
  private redisService: RedisService;
  private transactionService: TransactionService;
  private agentRepository: Repository<Agent>;
  private taskRepository: Repository<Task>;
  private twitterService?: TwitterService;
  private aiService?: IAIService;
  private logger: Logger;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.transactionService = TransactionService.getInstance();
    this.agentRepository = PostgresDataSource.getRepository(Agent);
    this.taskRepository = PostgresDataSource.getRepository(Task);
    this.logger = new Logger('AgentCoordination');
  }

  private async loadCharacterConfig(characterPath: string): Promise<void> {
    this.logger.info(`Loading character configuration from ${characterPath}`);
    try {
      const character = await loadCharacter(characterPath);
      this.logger.info(`Character ${character.name} loaded successfully`);
      
      // Initialize AI service with character configuration
      if (!this.aiService) {
        this.logger.info('Initializing AI service...');
        // Initialize AI service with character's model configuration
        const modelConfig = character.modelConfigurations.primary;
        this.aiService = {
          generateResponse: async (context) => {
            return `${character.name}: ${context.content || 'How can I help you?'}`;
          },
          generateMarketUpdate: async (params) => {
            const { action, data } = params;
            return `Market ${action}: Price ${data.price}, Volume ${data.volume24h}, Change ${data.priceChange24h}`;
          },
          setCharacterConfig: async (config) => {
            this.logger.info('Character configuration set');
          },
          analyzeMarket: async (data) => {
            return {
              shouldTrade: false,
              confidence: 0.5,
              action: 'HOLD',
              metrics: data
            };
          },
          shouldEngageWithContent: async () => false,
          determineEngagementAction: async () => ({
            type: 'ignore',
            confidence: 0
          }),
          generateMarketAnalysis: async () => 'Market analysis not available'
        };
      }
      
      if (this.aiService) {
        await this.aiService.setCharacterConfig(character);
      } else {
        throw new Error('AI service not initialized');
      }
      this.logger.info('AI service configured with character settings');
    } catch (error) {
      this.logger.error('Failed to load character configuration:', error);
      throw error;
    }
  }

  public async processCommand(input: string): Promise<string> {
    if (!this.aiService) {
      return 'AI service not initialized. Please load a character first.';
    }
    
    try {
      const response = await this.aiService.generateResponse({
        content: input,
        author: 'user',
        platform: 'terminal'
      });
      return response;
    } catch (error) {
      this.logger.error('Error processing command:', error);
      return 'Sorry, I encountered an error processing your command.';
    }
  }

  public async initializeTwitterService(): Promise<void> {
    this.logger.info('Twitter service initialization skipped per user request');
    return;
  }

  public async startAutonomousPosting(): Promise<void> {
    this.logger.info('Starting autonomous services...');
    
    if (this.twitterService) {
      // Start market monitoring and posting if Twitter is available
      const MARKET_MONITORING_INTERVAL = parseInt(process.env.MARKET_MONITORING_INTERVAL || '60000');
      
      setInterval(async () => {     
        try {
          await this.twitterService?.publishMarketUpdate({
            price: 0,
            volume24h: 0,
            priceChange24h: 0,
            marketCap: 0,
            topHolders: [],
            tokenAddress: function (tokenAddress: any): unknown {
              throw new Error('Function not implemented.');
            }
          });
        } catch (error) {
          this.logger.error('Error in autonomous posting:', error);
        }
      }, MARKET_MONITORING_INTERVAL);
      
      this.logger.info('Autonomous posting started successfully');
    } else {
      this.logger.info('Twitter service not available - skipping autonomous posting');
    }
  }

  public static getInstance(): AgentCoordinationService {
    if (!AgentCoordinationService.instance) {
      AgentCoordinationService.instance = new AgentCoordinationService();
    }
    return AgentCoordinationService.instance;
  }

  /**
   * Register a new agent in the swarm
   */
  async registerAgent(agentData: Partial<Agent>): Promise<Agent> {
    return await this.transactionService.executeTransaction(async (manager) => {
      const agent = manager.create(Agent, agentData);
      return await manager.save(Agent, agent);
    });
  }

  /**
   * Assign a task to an agent
   */
  async assignTask(taskData: Partial<Task>, agentId: string): Promise<Task> {
    const steps = [
      // Step 1: Create task
      async (manager: any) => {
        const task = manager.create(Task, { ...taskData, agentId });
        return await manager.save(Task, task);
      },
      // Step 2: Update agent status
      async (manager: any) => {
        const agent = await manager.findOne(Agent, { where: { id: agentId } });
        agent.lastActiveAt = new Date();
        return await manager.save(Agent, agent);
      }
    ];

    const compensations = [
      // Compensation for step 2
      async (result: any, manager: any) => {
        const agent = await manager.findOne(Agent, { where: { id: agentId } });
        agent.lastActiveAt = null;
        await manager.save(Agent, agent);
      },
      // Compensation for step 1
      async (result: Task, manager: any) => {
        await manager.remove(Task, result);
      }
    ];

    const [task] = await this.transactionService.executeSaga(steps, compensations);
    return task;
  }

  /**
   * Update task status and notify relevant agents
   */
  async updateTaskStatus(
    taskId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    result?: any
  ): Promise<void> {
    await this.transactionService.executeEventualConsistent(
      async () => {
        const task = await this.taskRepository.findOne({ where: { id: taskId } });
        if (!task) throw new Error('Task not found');

        task.status = status;
        if (status === 'COMPLETED' || status === 'FAILED') {
          task.completedAt = new Date();
          task.output = result;
        }

        await this.taskRepository.save(task);

        // Notify other agents about task status change
        await this.redisService.publish('task_updates', {
          taskId,
          status,
          result,
          timestamp: new Date()
        });
      },
      'task_status_updated',
      { taskId, status }
    );
  }

  /**
   * Store chat interaction in MongoDB
   */
  async storeChatInteraction(
    sessionId: string,
    agentId: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string }
  ): Promise<void> {
    let chatLog = await ChatLog.findOne({ sessionId });

    if (!chatLog) {
      chatLog = new ChatLog({
        sessionId,
        agentId,
        messages: [],
        status: 'active'
      });
    }

    chatLog.messages.push({
      ...message,
      timestamp: new Date()
    });

    await chatLog.save();
  }

  /**
   * Store analysis result in MongoDB
   */
  async storeAnalysisResult(analysisData: any): Promise<void> {
    const analysis = new AnalysisResult(analysisData);
    await analysis.save();
  }

  /**
   * Get agent metrics and status
   */
  async getAgentMetrics(agentId: string): Promise<any> {
    const cacheKey = `agent_metrics_${agentId}`;
    let metrics = await this.redisService.get(cacheKey);

    if (!metrics) {
      const agent = await this.agentRepository.findOne({ where: { id: agentId } });
      if (!agent) throw new Error('Agent not found');

      metrics = {
        ...agent.metrics,
        lastActiveAt: agent.lastActiveAt,
        isActive: agent.isActive
      };

      // Cache metrics for 5 minutes
      await this.redisService.set(cacheKey, metrics, 300);
    }

    return metrics;
  }

  /**
   * Subscribe to agent events
   */
  async subscribeToAgentEvents(
    agentId: string,
    callback: (event: any) => void
  ): Promise<void> {
    await this.redisService.subscribe(`agent_${agentId}_events`, callback);
  }
}                              