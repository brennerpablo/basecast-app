/**
 * DataTableMultilevel — árvore N níveis com ColumnMetadata, Filterbar, export.
 * @see DataTableMultilevel para quando usar vs `expandableGroups`.
 */
export { DataTableMultilevel } from "./DataTableMultilevel";
export { defaultHierarchyCell } from "./defaultHierarchyCell";
export {
  defaultVisibleLevelIds,
  filterMultilevelTreeByLevels,
} from "./filterMultilevelTreeByLevels";
export {
  MultilevelExpansionControls,
} from "./MultilevelExpansionControls";
export {
  MultilevelHierarchyLevelOptions,
  useMultilevelVisibleLevels,
} from "./MultilevelHierarchyLevelOptions";
export {
  applyMultilevelLazyRender,
  collectAllNodeKeys,
  countMultilevelTreeRows,
  flattenMultilevelTree,
  MULTILEVEL_EXPAND_COLUMN_ID,
  MULTILEVEL_HIERARCHY_COLUMN_ID,
  type MultilevelFlatRow,
  pruneMultilevelTree,
} from "./treeUtils";
export { collectExpandableParentIds,useMultilevelExpansion } from "./useMultilevelExpansion";
