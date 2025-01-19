// components/IntermediateStep.tsx
import { Message } from "ai";
import { CodeBlock } from "./ui/CodeBlock";


interface IntermediateStepProps {
  message: Message;
}

export function IntermediateStep({ message }: IntermediateStepProps) {
  let content: { action?: any; observation?: string } = {};
  
  try {
    content = JSON.parse(message.content);
  } catch (e) {
    console.error("Failed to parse intermediate step:", e);
    return null;
  }

  return (
    <div className="ml-4 border-l-2 border-gray-300 pl-4 my-2">
      <div className="text-sm text-gray-500">Working on it...</div>
      {content.action && (
        <div className="my-2">
          <div className="font-medium text-gray-700">Action:</div>
          <CodeBlock 
            code={JSON.stringify(content.action, null, 2)}
            language="json"
          />
        </div>
      )}
      {content.observation && (
        <div className="my-2">
          <div className="font-medium text-gray-700">Result:</div>
          <CodeBlock 
            code={content.observation}
            language="text"
          />
        </div>
      )}
    </div>
  );
}