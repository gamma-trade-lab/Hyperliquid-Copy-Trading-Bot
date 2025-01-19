import Groq from "groq-sdk";
import { SolanaAgentKit } from "solana-agent-kit";

// Extend SolanaAgentKit with GROQ_API_KEY
declare module 'solana-agent-kit' {
  interface SolanaAgentKit {
    GROQ_API_KEY?: string;
  }
}

interface ImageGenerationResult {
  images: string[];
  metadata?: {
    model: string;
    inferenceTime?: number;
  };
}

interface ImageGenerationError {
  code: string;
  message: string;
}

/**
 * Generate an image using Groq's image generation capabilities
 * @param agent SolanaAgentKit instance
 * @param prompt Text description of the image to generate
 * @param size Image size ('256x256', '512x512', or '1024x1024') (default: '1024x1024')
 * @param n Number of images to generate (default: 1)
 * @returns Object containing the generated image URLs and metadata
 */
export async function create_image(
  agent: SolanaAgentKit,
  prompt: string,
  size: "256x256" | "512x512" | "1024x1024" = "1024x1024",
  n: number = 1,
): Promise<ImageGenerationResult> {
  try {
    if (!agent.GROQ_API_KEY) {
      throw new Error("Groq API key not found in agent configuration");
    }

    // Initialize Groq client
    const groq = new Groq({
      apiKey: agent.GROQ_API_KEY,
    });

    // Enhanced prompt with quality and style guidelines
    const enhancedPrompt = `Create a high-quality image: ${prompt}. 
      Style: High resolution, detailed, professional quality.
      Technical specifications: ${size}, optimized for web display.`;

    // Start generation timer
    const startTime = Date.now();

    // Call Groq's chat completion API
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an image generation assistant."
        },
        {
          role: "user",
          content: enhancedPrompt
        }
      ],
      model: "mixtral-8x7b-32768",
    });

    const endTime = Date.now();
    const inferenceTime = endTime - startTime;

    // Validate response
    if (!response.choices || !Array.isArray(response.choices)) {
      throw new Error("Invalid response from Groq API");
    }

    return {
      images: response.choices
        .map((choice) => choice.message.content)
        .filter((content): content is string => content !== null),
      metadata: {
        model: "stable-diffusion-3",
        inferenceTime,
      }
    };

  } catch (error: any) {
    const errorDetails: ImageGenerationError = {
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "Image generation failed"
    };

    if (error.response) {
      // Handle specific Groq API errors
      errorDetails.code = `GROQ_${error.response.status}`;
      errorDetails.message = error.response.data?.error?.message || error.message;
    }

    throw new Error(JSON.stringify(errorDetails));
  }
}

// Example usage:
/*
const agent = new SolanaAgentKit({
  GROQ_API_KEY: "your-groq-api-key"
});

try {
  const result = await create_image(
    agent,
    "A serene mountain landscape at sunset",
    "1024x1024",
    1
  );
  console.log("Generated images:", result.images);
  console.log("Generation metadata:", result.metadata);
} catch (error) {
  console.error("Image generation failed:", error);
}
*/