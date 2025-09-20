import React from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  input: string;
  setInput: (v: string) => void;
  handleSend: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({ input, setInput, handleSend, handleKeyPress, isLoading, inputRef }) => (
  <div className="p-4 border-t border-gray-200">
    <div className="flex space-x-2">
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 custom-ring-accent focus:border-transparent text-black"
          rows={1}
          style={{ minHeight: '40px', maxHeight: '120px', height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
          disabled={isLoading}
        />
      </div>
      <button
        onClick={handleSend}
        disabled={!input.trim() || isLoading}
        className={cn(
          "px-4 py-2 rounded-lg custom-button text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 custom-ring-accent",
          (!input.trim() || isLoading) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
    </div>
    <p className="text-xs text-gray-500 mt-2">
      Press Enter to send, Shift+Enter for new line
    </p>
  </div>
);

export default ChatInput; 