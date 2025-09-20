import { Node, Edge } from '@xyflow/react';

export interface NodeData {
  label: string;
  category: 'Data source' | 'Polyvalent';
}

export interface ChatNodeData extends NodeData {
  type: 'chat';
  content?: string;
  content_id?: string;
}

export interface PDFNodeData extends NodeData {
  type: 'pdf';
  content?: string;
}

export interface WebsiteNodeData extends NodeData {
  type: 'website';
  url?: string | null;
  content?: string;
  is_placeholder?: boolean;
  placeholder_id?: string;
  graph_id?: string;
  content_id?: string;
}

export interface YouTubeNodeData extends NodeData {
  type: 'youtube';
  url?: string;
  transcript?: string;
  content?: string;
}

export interface InstagramNodeData extends NodeData {
  type: 'instagram';
  url?: string;
  transcript?: string;
  content?: string;
}

export interface ArtefactNodeData extends NodeData {
  type: 'artefact';
  content?: string;
  artefactId?: string;
  chatSessionId?: string;
  isLoading?: boolean;
  error?: string;
  // Processing options persistence fields
  processingOptions?: any;
  selectedProcessingOption?: any;
  processingOutputType?: string;
}

export interface DocumentNodeData extends NodeData {
  type: 'document';
  content?: string;
  artefactId?: string;
  chatSessionId?: string;
  isLoading?: boolean;
  error?: string;
  // Processing options persistence fields
  processingOptions?: any;
  selectedProcessingOption?: any;
  processingOutputType?: string;
}

export interface TableNodeData extends NodeData {
  type: 'table';
  content?: string;
  artefactId?: string;
  chatSessionId?: string;
  isLoading?: boolean;
  error?: string;
  // Processing options persistence fields
  processingOptions?: any;
  selectedProcessingOption?: any;
  processingOutputType?: string;
}

export interface GraphNodeData extends NodeData {
  type: 'graph';
  content?: string;
  artefactId?: string;
  chatSessionId?: string;
  isLoading?: boolean;
  error?: string;
  // Processing options persistence fields
  processingOptions?: any;
  selectedProcessingOption?: any;
  processingOutputType?: string;
}

export type FlowNodeData = ChatNodeData | PDFNodeData | WebsiteNodeData | YouTubeNodeData | InstagramNodeData | ArtefactNodeData | DocumentNodeData | TableNodeData | GraphNodeData;

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  nodeId: number;
}

export interface SelectionState {
  selectedNodes: Node[];
  selectedEdges: Edge[];
  hasSelection: boolean;
}

export interface NodeMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChatNode: () => Promise<void>;
  onAddPDFNode: () => Promise<void>;
  onAddWebsiteNode: () => Promise<void>;
  onAddYouTubeNode: () => Promise<void>;
  onAddInstagramNode: () => Promise<void>;
  onAddArtefactNode: () => Promise<void>;
}

export interface ToolbarProps {
  onClearFlow: () => Promise<void>;
  onDownloadFlow: () => void;
  onDeleteSelected: () => Promise<void>;
  hasSelection: boolean;
  edgeManager?: unknown; // Optional edge manager for extended functionality
  orientation?: 'vertical' | 'horizontal'; // New prop for responsive layout
  graphColor?: string | null; // Board color for tinted glass styling
  currentNodeCount?: number; // Current node count for limit checking
} 