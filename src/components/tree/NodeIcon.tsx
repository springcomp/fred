import { AtSign, Diamond, FileCode, FolderOpen, GitBranch, ListOrdered, type LucideProps } from 'lucide-react';
import type { FFNode, InsertableKind } from '@/model/types';

interface NodeIconProps extends LucideProps {
  node: FFNode;
}

const iconMap: Record<FFNode['kind'], React.ComponentType<LucideProps>> = {
  schema: FileCode,
  record: FolderOpen,
  sequence: ListOrdered,
  choice: GitBranch,
  element: Diamond,
  attribute: AtSign,
};

const colorMap: Record<FFNode['kind'], string> = {
  schema: 'text-node-schema',
  record: 'text-node-record',
  sequence: 'text-node-sequence',
  choice: 'text-node-choice',
  element: 'text-node-element',
  attribute: 'text-node-attribute',
};

export function NodeIcon({ node, ...props }: NodeIconProps) {
  const Icon = iconMap[node.kind];
  const color = colorMap[node.kind];
  return <Icon className={color} size={16} {...props} />;
}

export function nodeKindLabel(kind: FFNode['kind']): string {
  switch (kind) {
    case 'schema':
      return 'Schema';
    case 'record':
      return 'Record';
    case 'sequence':
      return 'Sequence';
    case 'choice':
      return 'Choice';
    case 'element':
      return 'Element';
    case 'attribute':
      return 'Attribute';
  }
}

/** Shared icon map for insertable node kinds. */
export const insertKindIcon: Record<InsertableKind, React.ReactNode> = {
  record: <FolderOpen size={14} className="text-node-record" />,
  element: <Diamond size={14} className="text-node-element" />,
  sequence: <ListOrdered size={14} className="text-node-sequence" />,
  choice: <GitBranch size={14} className="text-node-choice" />,
  attribute: <AtSign size={14} className="text-node-attribute" />,
};

/** Display label for an insertable kind (maps 'element' → 'Field'). */
export function insertKindLabel(kind: InsertableKind): string {
  return kind === 'element' ? 'Field' : nodeKindLabel(kind);
}
