import React from "react";
import { Bot, Globe, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

interface ChatHeaderProps {
  enableWebSearch: boolean;
  setEnableWebSearch: (v: boolean) => void;
  isLoading: boolean;
  clearChat: () => void;
  cancelStream?: () => void;
  model: string;
  setModel: (model: string) => void;
  temperature: number;
  setTemperature: (temperature: number) => void;
  compact?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  enableWebSearch,
  setEnableWebSearch,
  isLoading,
  model,
  setModel,
  temperature,
  setTemperature,
  compact = false,
  cancelStream,
}) => {
  const models = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "o4-mini"];

  return (
    <div className={`flex items-center justify-between ${compact ? 'p-2' : 'p-4'} border-b border-gray-200`}>
      <div className="flex items-center space-x-2">
        <Bot className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} text-blue-600`} />
        <h2 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>Chat Assistant</h2>
      </div>
      <div className="flex items-center space-x-4">
        {isLoading && cancelStream && (
          <button
            onClick={cancelStream}
            className={`inline-flex items-center justify-center rounded-lg px-3 ${compact ? 'py-1.5 text-sm' : 'py-3 text-base'} font-medium bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500`}
            aria-label="Stop Generation"
            title="Stop generation"
          >
            <Square className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} /> Stop
          </button>
        )}
        <Select.Root value={model} onValueChange={setModel} disabled={isLoading}>
          <Select.Trigger
            className={`inline-flex items-center justify-center rounded-lg px-4 ${compact ? 'py-1.5 text-sm' : 'py-3 text-base'} font-medium bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label="Model"
          >
            <Select.Value placeholder="Select a model..." />
            <Select.Icon className="ml-2">
              <ChevronDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="overflow-hidden bg-white rounded-md shadow-lg border border-gray-200">
              <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white cursor-default">
                <ChevronUpIcon />
              </Select.ScrollUpButton>
              <Select.Viewport className="p-2">
                {models.map((m) => (
                  <Select.Item
                    key={m}
                    value={m}
                    className="text-base text-gray-900  rounded flex items-center h-10 px-3 relative select-none data-[disabled]:text-gray-900 data-[highlighted]:outline-none data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900"
                  >
                     <Select.ItemIndicator className=" left-0 w-6 inline-flex items-center justify-center">
                      <CheckIcon />
                    </Select.ItemIndicator>
                    <Select.ItemText>{m}</Select.ItemText> 
                   
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white cursor-default">
                <ChevronDownIcon />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        
        {/* Temperature Control */}
        <div className="flex items-center space-x-3">
          <label className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 font-medium`}>Temp:</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            disabled={isLoading}
            className={`${compact ? 'w-20 h-2' : 'w-20 h-3'} bg-gray-200 rounded-lg appearance-none cursor-pointer slider`}
          />
          <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 w-10`}>{temperature}</span>
        </div>
        
        <button
          onClick={() => setEnableWebSearch(!enableWebSearch)}
          className={cn(
            `flex items-center justify-center space-x-2 px-6 ${compact ? 'py-1.5 text-sm' : 'py-3 text-base'} rounded-lg border transition-colors w-44`,
            enableWebSearch
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
          )}
          disabled={isLoading}
        >
          <Globe className={`${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
          <span className={`${compact ? 'text-sm' : 'text-base'} font-medium`}>
            {enableWebSearch ? "Web Search ON" : "Web Search OFF"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;