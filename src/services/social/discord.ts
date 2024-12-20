import { 
  Client as DiscordClient, 
  GatewayIntentBits, 
  Message, 
  TextChannel, 
  EmbedBuilder,
  Interaction,
  ApplicationCommandType,
  ChatInputCommandInteraction
} from 'discord.js';
import { PublicKey } from '@solana/web3.js';
import { AIService } from '../ai/types';
import { WalletService, TokenService } from '../blockchain/types';

interface DiscordConfig {
  token: string;
  guildId: string;
  aiService: AIService;
  walletService?: WalletService;
  tokenService?: TokenService;
}

interface CommandHandler {
  name: string;
  description: string;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export class DiscordService {
  private discordClient: DiscordClient;
  private commands: Map<string, CommandHandler>;
  private guildId: string;
  private aiService: AIService;
  private walletService?: WalletService;
  private tokenService?: TokenService;

  constructor(config: DiscordConfig) {
    this.discordClient = new DiscordClient({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });

    this.guildId = config.guildId;
    this.aiService = config.aiService;
    this.walletService = config.walletService;
    this.tokenService = config.tokenService;
    this.commands = new Map();

    this.initializeCommands();
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    try {
      await this.discordClient.login(process.env.DISCORD_TOKEN);
      console.log('Discord bot is online!');
      await this.registerCommands();
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  private initializeCommands(): void {
    this.commands.set('price', {
      name: 'price',
      description: 'Get token price and market info',
      execute: async (interaction) => {
        await this.handlePriceCommand(interaction);
      }
    });

    this.commands.set('wallet', {
      name: 'wallet',
      description: 'Get wallet information or create a new wallet',
      execute: async (interaction) => {
        await this.handleWalletCommand(interaction);
      }
    });

    this.commands.set('market', {
      name: 'market',
      description: 'Get market analysis from the AI',
      execute: async (interaction) => {
        await this.handleMarketCommand(interaction);
      }
    });

    this.commands.set('airdrop', {
      name: 'airdrop',
      description: 'Request an airdrop of tokens',
      execute: async (interaction) => {
        await this.handleAirdropCommand(interaction);
      }
    });
  }

  private setupEventHandlers(): void {
    this.discordClient.on('ready', () => {
      console.log(`Logged in as ${this.discordClient.user?.tag}!`);
    });

    this.discordClient.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Error executing command:', error);
        await interaction.reply({
          content: 'There was an error executing this command!',
          ephemeral: true
        });
      }
    });

    this.discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      await this.handleMessage(message);
    });
  }

  private async registerCommands(): Promise<void> {
    try {
      const guild = await this.discordClient.guilds.fetch(this.guildId);
      const commandData = Array.from(this.commands.values()).map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        type: ApplicationCommandType.ChatInput
      }));

      await guild.commands.set(commandData as any);
      console.log('Commands registered successfully!');
    } catch (error) {
      console.error('Error registering commands:', error);
      throw error;
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      // Check if message mentions the bot
      if (message.mentions.has(this.discordClient.user!)) {
        const response = await this.aiService.generateResponse({
          content: message.content,
          author: message.author.tag,
          channel: message.channel.id,
          platform: 'discord'
        });

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setDescription(response)
          .setFooter({ text: 'AI Agent Response' });

        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private async handlePriceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    try {
      // Get token price info
      const tokenInfo = await this.tokenService?.getTokenInfo(
        new PublicKey(process.env.TOKEN_ADDRESS!)
      );

      const price = tokenInfo?.metadata?.price || 'N/A';
      const marketCap = tokenInfo?.metadata?.marketCap || 'N/A';
      const volume24h = tokenInfo?.metadata?.volume24h || 'N/A';

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Token Price Information')
        .addFields(
          { name: 'Price', value: `$${price}`, inline: true },
          { name: 'Market Cap', value: `$${marketCap}`, inline: true },
          { name: '24h Volume', value: `$${volume24h}`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling price command:', error);
      await interaction.editReply('Error fetching price information!');
    }
  }

  private async handleWalletCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    try {
      const userId = interaction.user.id;
      const wallet = await this.walletService?.createWallet('crossmint', {
        linkedUser: userId
      });

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Wallet Created')
        .setDescription(`Your wallet address: ${wallet}`)
        .addFields(
          { name: 'Type', value: 'Crossmint Custodial Wallet', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling wallet command:', error);
      await interaction.editReply('Error creating wallet!');
    }
  }

  private async handleMarketCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    try {
      const analysis = await this.aiService.generateMarketAnalysis();

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Market Analysis')
        .setDescription(analysis)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling market command:', error);
      await interaction.editReply('Error generating market analysis!');
    }
  }

  private async handleAirdropCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    try {
      // Implement airdrop logic
      const amount = 100; // Example amount
      const userId = interaction.user.id;
      
      // Add airdrop implementation here

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Airdrop Successful')
        .setDescription(`You received ${amount} tokens!`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling airdrop command:', error);
      await interaction.editReply('Error processing airdrop!');
    }
  }

  async sendMessage(channelId: string, content: string | { title: string; description: string; fields: { name: string; value: string; inline: boolean; }[]; }): Promise<void> {
    try {
      const channel = await this.discordClient.channels.fetch(channelId) as TextChannel;
      if (!channel) throw new Error('Channel not found');

      if (typeof content === 'string') {
        await channel.send(content);
      } else {
        const embed = new EmbedBuilder()
          .setTitle(content.title)
          .setDescription(content.description)
          .addFields(content.fields);

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.discordClient.destroy();
    } catch (error) {
      console.error('Error cleaning up Discord service:', error);
    }
  }
}