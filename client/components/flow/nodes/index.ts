import { ChatNode } from './ChatNode';
import { PDFNode } from './PDFNode';
import { WebsiteNode } from './WebsiteNode';
import { YouTubeNode } from './YouTubeNode';
import { InstagramNode } from './InstagramNode';
import { DocumentNode } from './DocumentNode';
import { TableNode } from './TableNode';
import { GraphNode } from './GraphNode';
import { ArtefactNode } from './ArtefactNode';

// Node types registered with React Flow
// Note: Individual components are already memoized in their own files
export const nodeTypes = {
  chatNode: ChatNode,
  pdfNode: PDFNode,
  websiteNode: WebsiteNode,
  youtubeNode: YouTubeNode,
  instagramNode: InstagramNode,
  documentNode: DocumentNode,
  tableNode: TableNode,
  graphNode: GraphNode,
  // Fallback type for unspecified artefact kinds
  artefactNode: ArtefactNode,
};

// Export individual components for direct use
export { ChatNode } from './ChatNode';
export { PDFNode } from './PDFNode';
export { WebsiteNode } from './WebsiteNode';
export { YouTubeNode } from './YouTubeNode';
export { InstagramNode } from './InstagramNode';
export { DocumentNode } from './DocumentNode';
export { TableNode } from './TableNode';
export { GraphNode } from './GraphNode'; 
export { ArtefactNode } from './ArtefactNode';