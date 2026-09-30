import type { ReactElement, ReactNode } from 'react';

type Node = ReactNode | ReactElement<{ children?: ReactNode }>;

// Finds un-rendered elements of one tag, so click handlers can be called without a browser
export function findElements(tree: Node, tag: string) {
  const found: ReactElement<{ onClick?: () => void }>[] = [];
  const walk = (node: Node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const element = node as ReactElement<{
      onClick?: () => void;
      children?: ReactNode;
    }>;
    if (element.type === tag) found.push(element);
    walk(element.props?.children);
  };
  walk(tree);
  return found;
}
