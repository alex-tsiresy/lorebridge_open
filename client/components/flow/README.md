# Flow Component Architecture

This directory contains a modular, extensible flow diagram system built with React Flow. The architecture is designed to easily accommodate new node types, edge types, and tools.

## Directory Structure

```
flow/
├── hooks/
│   └── useFlowManager.ts          # Main flow state management hook
├── nodes/
│   ├── ChatNode.tsx              # Chat node component
│   ├── PDFNode.tsx               # PDF viewer node component
│   └── index.ts                  # Node exports and nodeTypes config
├── ui/
│   ├── AddNodeMenu.tsx           # Dropdown menu for adding nodes
│   ├── FlowCanvas.tsx            # ReactFlow wrapper component
│   └── FlowToolbar.tsx           # Main toolbar component
├── constants.ts                  # Configuration constants
├── types.ts                      # TypeScript type definitions
├── utils.ts                      # Utility functions
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Key Components

### 1. `useFlowManager` Hook
Central state management for the entire flow:
- Node and edge state management
- CRUD operations for nodes and edges
- Menu state management
- Flow operations (clear, download, etc.)

### 2. Node Components
Modular node components in the `nodes/` directory:
- `ChatNode`: Interactive chat interface node
- `PDFNode`: PDF viewer node with dynamic resizing
- Easy to extend with new node types

### 3. UI Components
Reusable UI components:
- `FlowToolbar`: Main toolbar with actions
- `AddNodeMenu`: Dropdown for node selection
- `FlowCanvas`: ReactFlow wrapper with configuration

## Adding New Node Types

To add a new node type (e.g., VideoNode):

### 1. Create the Node Component
```typescript
// nodes/VideoNode.tsx
export function VideoNode({ data, isConnectable, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const { getZoom } = useReactFlow();
  const zoom = getZoom();
  
  const handleStyle = calculateHandleStyle(zoom, NODE_COLORS.VIDEO.handle);
  
  return (
    <div className="shadow-lg rounded-lg bg-white border-2 border-purple-400 w-full h-full min-w-80 min-h-80">
      {/* Node implementation */}
    </div>
  );
}
```

### 2. Add Node Type to Constants
```typescript
// constants.ts
export const NODE_COLORS = {
  // ... existing colors
  VIDEO: {
    border: '#8b5cf6',
    background: '#f3e8ff',
    handle: '#8b5cf6',
  },
} as const;
```

### 3. Update Node Types Configuration
```typescript
// nodes/index.ts
export { VideoNode } from './VideoNode';

export const nodeTypes = {
  chatNode: ChatNode,
  pdfNode: PDFNode,
  videoNode: VideoNode, // Add new node type
};
```

### 4. Add to Menu and Hook
```typescript
// ui/AddNodeMenu.tsx - Add menu item
<button onClick={onAddVideoNode}>
  <Video className="h-4 w-4 text-purple-600" />
  <span>Video Node</span>
</button>

// hooks/useFlowManager.ts - Add node creation function
const addVideoNode = useCallback(() => {
  const newNode: Node = {
    id: nodeId.toString(),
    type: 'videoNode',
    position: generateRandomPosition(),
    data: { label: `Video Node ${nodeId}` },
    style: { 
      width: NODE_SIZES.DEFAULT_WIDTH,
      height: NODE_SIZES.DEFAULT_HEIGHT,
    },
  };
  setNodes((nds) => [...nds, newNode]);
  setNodeId((id) => id + 1);
  setShowNodeMenu(false);
}, [nodeId, setNodes]);
```

## Adding New Edge Types

### 1. Define Edge Styles
```typescript
// constants.ts
export const EDGE_STYLES = {
  DEFAULT: { /* existing */ },
  DASHED: {
    strokeDasharray: '10,5',
    strokeWidth: 3,
    stroke: '#ef4444',
  },
  DOTTED: {
    strokeDasharray: '2,2',
    strokeWidth: 2,
    stroke: '#06b6d4',
  },
} as const;
```

### 2. Add Edge Type Selection
Create an edge type selector in the toolbar or add context menu functionality to existing edges.

## Adding New Tools

### 1. Create Tool Component
```typescript
// ui/ToolSelector.tsx
export function ToolSelector({ activeTool, onToolChange }: ToolSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <button 
        onClick={() => onToolChange('select')}
        className={activeTool === 'select' ? 'active' : ''}
      >
        Select
      </button>
      <button 
        onClick={() => onToolChange('pan')}
        className={activeTool === 'pan' ? 'active' : ''}
      >
        Pan
      </button>
    </div>
  );
}
```

### 2. Add to Flow Manager
```typescript
// hooks/useFlowManager.ts
const [activeTool, setActiveTool] = useState('select');

const handleToolChange = useCallback((tool: string) => {
  setActiveTool(tool);
  // Update ReactFlow interaction modes based on tool
}, []);
```

## Extensibility Features

### Type Safety
- Strong TypeScript types for all components
- Generic interfaces for easy extension
- Compile-time checking for new node/edge types

### Configuration-Driven
- Centralized constants for easy theming
- Configurable node sizes, colors, and behaviors
- Extensible utility functions

### Modular Architecture
- Separate concerns (UI, logic, data)
- Easy to test individual components
- Clean import/export structure

### Future Extensions
The architecture supports:
- Custom edge components
- Node-specific toolbars
- Drag-and-drop from external sources
- Keyboard shortcuts
- Collaborative editing
- Undo/redo functionality
- Custom themes
- Plugin system

## Usage Example

```typescript
import { WhiteBoardView } from './components/WhiteBoardView';
import { useFlowManager } from './components/flow';

function App() {
  return <WhiteBoardView />;
}

// Or for custom usage:
function CustomFlow() {
  const flowManager = useFlowManager();
  
  return (
    <div>
      <FlowToolbar {...flowManager} />
      <FlowCanvas {...flowManager} />
    </div>
  );
}
```

This architecture provides a solid foundation for building sophisticated flow-based applications while maintaining clean, maintainable code. 