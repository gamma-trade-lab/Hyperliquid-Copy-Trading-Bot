// src/services/social.ts

import { TwitterApi } from 'twitter-api-v2';
import { Client as DiscordClient, TextChannel, Message } from 'discord.js';
import { CONFIG } from '../config/settings';
import { aiService } from './ai';

interface SocialMessage {
   platform: 'twitter' | 'discord';
   content: string;
   author: string;
   id: string;
   timestamp: Date;
}

interface TwitterConfig {
   apiKey: string;
   username: string; 
}

interface DiscordConfig {
   token: string;
   allowedChannels: string[];
}

export class SocialService {
   private twitter: TwitterApi;
   private discord: DiscordClient;
   private messageQueue: SocialMessage[] = [];
   private isProcessing: boolean = false;

   constructor() {
       // Initialize Twitter
       this.twitter = new TwitterApi(CONFIG.SOCIAL.TWITTER.API_KEY);
       
       // Initialize Discord
       this.discord = new DiscordClient({ 
           intents: ["GuildMessages", "DirectMessages", "MessageContent"]
       });

       this.setupDiscordEvents();
       this.startMessageProcessor();
   }

   /**
    * Initialize social media connections
    */
   async initialize(): Promise<void> {
       try {
           // Start Discord bot
           await this.discord.login(CONFIG.SOCIAL.DISCORD.TOKEN);
           console.log('Discord bot initialized');

           // Verify Twitter credentials
           const twitterClient = await this.twitter.v2.me();
           console.log('Twitter bot initialized', twitterClient.data.username);

           // Start monitoring Twitter mentions
           await this.startTwitterStream();
       } catch (error) {
           console.error('Error initializing social services:', error);
           throw error;
       }
   }

   /**
    * Post content to all social platforms
    */
   async broadcast(content: string): Promise<void> {
       try {
           // Post to Twitter
           await this.twitter.v2.tweet(content);

           // Post to Discord channels
           const channels = CONFIG.SOCIAL.DISCORD.ALLOWED_CHANNELS;
           for (const channelId of channels) {
               const channel = this.discord.channels.cache.get(channelId) as TextChannel;
               if (channel) {
                   await channel.send(content);
               }
           }
       } catch (error) {
           console.error('Error broadcasting message:', error);
           throw error;
       }
   }

   /**
    * Start Twitter stream for mentions
    */
   private async startTwitterStream(): Promise<void> {
       try {
           // Set up rules for tweet filtering
           const rules = await this.twitter.v2.streamRules();
           if (!rules.data?.length) {
               await this.twitter.v2.updateStreamRules({
                   add: [{ value: `@${CONFIG.SOCIAL.TWITTER.USERNAME}` }]
               });
           }

           // Start the stream
           const stream = await this.twitter.v2.searchStream({
               'tweet.fields': ['referenced_tweets', 'author_id', 'created_at'],
               expansions: ['referenced_tweets.id']
           });

           stream.on('data', async tweet => {
               // Queue the tweet for processing
               this.messageQueue.push({
                   platform: 'twitter',
                   content: tweet.text,
                   author: tweet.author_id,
                   id: tweet.id,
                   timestamp: new Date()
               });
           });

           stream.on('error', error => {
               console.error('Twitter stream error:', error);
           });
       } catch (error) {
           console.error('Error starting Twitter stream:', error);
       }
   }

   /**
    * Setup Discord event handlers
    */
   private setupDiscordEvents(): void {
       this.discord.on('messageCreate', async (message: Message) => {
           // Ignore bot messages and messages from non-allowed channels
           if (message.author.bot || 
               !CONFIG.SOCIAL.DISCORD.ALLOWED_CHANNELS.includes(message.channel.id)) {
               return;
           }

           // Queue the message for processing
           this.messageQueue.push({
               platform: 'discord',
               content: message.content,
               author: message.author.id,
               id: message.channel.id, // Use channel ID instead of message ID
               timestamp: new Date()
           });
       });

       this.discord.on('error', error => {
           console.error('Discord error:', error);
       });
   }

   /**
    * Process message queue
    */
   private async startMessageProcessor(): Promise<void> {
       setInterval(async () => {
           if (this.isProcessing || this.messageQueue.length === 0) return;

           this.isProcessing = true;
           const message = this.messageQueue.shift();

           if (message) {
               try {
                   // Generate AI response
                   const response = await aiService.generateResponse({
                       content: message.content, 
                       platform: message.platform
                   });

                   // Send response based on platform
                   if (message.platform === 'twitter') {
                       await this.twitter.v2.reply(response, message.id);
                   } else {
                       const channel = this.discord.channels.cache.get(message.id) as TextChannel;
                       if (channel) {
                           await channel.send(response);
                       }
                   }
               } catch (error) {
                   console.error('Error processing message:', error);
               }
           }

           this.isProcessing = false;
       }, 1000); // Process one message per second
   }

   /**
    * Schedule regular content posting
    */
   async scheduleContent(): Promise<void> {
       setInterval(async () => {
           try {
               const memeContent = await aiService.generateMemeContent();
               await this.broadcast(memeContent.text);
           } catch (error) {
               console.error('Error scheduling content:', error);
           }
       }, CONFIG.SOCIAL.TWITTER.POSTING_INTERVAL);
   }

   /**
    * Handle rate limits and cooldowns
    */
   private isRateLimited(platform: 'twitter' | 'discord'): boolean {
       // Implement rate limiting logic
       return false;
   }
}

// Export singleton instance
export const socialService = new SocialService();
export default socialService;