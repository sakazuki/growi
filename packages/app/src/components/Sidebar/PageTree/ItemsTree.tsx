import React, { FC } from 'react';

import { IPage } from '../../../interfaces/page';
import { ItemNode } from './ItemNode';
import Item from './Item';
import { useSWRxPageAncestorsChildren } from '../../../stores/page-listing';
import { useTargetAndAncestors } from '../../../stores/context';
import { HasObjectId } from '../../../interfaces/has-object-id';


/*
 * Utility to generate initial node
 */
const generateInitialNodeBeforeResponse = (targetAndAncestors: Partial<IPage>[]): ItemNode => {
  const nodes = targetAndAncestors.map((page): ItemNode => {
    return new ItemNode(page, []);
  });

  // update children for each node
  const rootNode = nodes.reduce((child, parent) => {
    parent.children = [child];
    return parent;
  });

  return rootNode;
};

const generateInitialNodeAfterResponse = (ancestorsChildren: Record<string, Partial<IPage & HasObjectId>[]>, rootNode: ItemNode): ItemNode => {
  const paths = Object.keys(ancestorsChildren);

  let currentNode = rootNode;
  paths.reverse().forEach((path) => {
    const childPages = ancestorsChildren[path];
    currentNode.children = ItemNode.generateNodesFromPages(childPages);

    const nextNode = currentNode.children.filter((node) => {
      return paths.includes(node.page.path as string);
    })[0];
    currentNode = nextNode;
  });

  return rootNode;
};

type ItemsTreeProps = {
  path: string
}


/*
 * ItemsTree
 */
const ItemsTree: FC<ItemsTreeProps> = (props: ItemsTreeProps) => {
  const { data, error } = useTargetAndAncestors();

  const { data: ancestorsChildrenData, error: error2 } = useSWRxPageAncestorsChildren(props.path);

  if (error != null || error2 != null) {
    return null;
  }

  if (data == null) { // when not permalink
    return null;
  }

  const { targetAndAncestors, rootPage } = data;

  let initialNode: ItemNode;

  /*
   * Before swr response comes back
   */
  if (ancestorsChildrenData == null) {
    initialNode = generateInitialNodeBeforeResponse(targetAndAncestors);
  }

  /*
   * When swr request finishes
   */
  else {
    const { ancestorsChildren } = ancestorsChildrenData;

    const rootNode = new ItemNode(rootPage);

    initialNode = generateInitialNodeAfterResponse(ancestorsChildren, rootNode);
  }

  const isOpen = true;
  return (
    <div className="grw-pagetree p-3">
      <Item key={initialNode.page.path} itemNode={initialNode} isOpen={isOpen} />
    </div>
  );
};


export default ItemsTree;
