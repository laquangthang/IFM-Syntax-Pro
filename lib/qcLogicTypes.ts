/**
 * QC Logic Canvas Types
 * Based on the QC Logic Canvas & Syntax Generation Documentation
 */

/**
 * Variable Types for QC Logic Nodes
 */
export type VariableType = 
  | 'SA'           // Single Answer
  | 'MA'           // Multiple Answer
  | 'SA_GRID'      // SA Grid
  | 'MA_GRID'      // MA Grid
  | 'OE'           // Open Ended
  | 'RANKING_ALL'  // Ranking - All items must be ranked
  | 'RANKING_FIXED' // Ranking - Fixed number of items
  | 'UNCLASSIFIED' // Generic/Unclassified

/**
 * Edge/Connection Types
 */
export type EdgeType = 
  | 'F0'        // Default structural connection
  | 'F1'        // Level 1 Hierarchy: Parent Grid -> Rows/Children
  | 'F2'        // Level 2 Hierarchy: Intermediate -> Leaf nodes
  | 'ASK_IF'    // Dependency: Target asked IF Source meets condition
  | 'PIPING'    // Data Flow: Target relevance depends on Source value

/**
 * Condition Operators
 */
export type ConditionOperator = 
  | '=' 
  | '>' 
  | '<' 
  | '>=' 
  | '<=' 
  | '<>'

/**
 * Condition Type
 */
export interface Condition {
  type: 'comparison' | 'have_any' | 'missing'
  operator?: ConditionOperator
  value?: string | number
  values?: (string | number)[] // For 'have_any'
}

/**
 * QC Logic Node (Variable)
 */
export interface QCNode {
  id: string                    // Variable name (e.g., Q1, Q2_1)
  name: string                  // Display name
  type: VariableType            // Variable type
  maxValue?: number             // Max value (e.g., Max ranks, Max answers)
  minValue?: number             // Min value (e.g., Min answers)
  fixedValue?: number           // Fixed value for validation
  conditions?: Condition[]      // User-defined conditions
  position?: { x: number; y: number } // Canvas position (optional for UI)
}

/**
 * QC Logic Edge (Connection)
 */
export interface QCEdge {
  id: string                    // Edge ID
  from: string                  // Source node ID
  to: string                    // Target node ID
  type: EdgeType                // Connection type
  condition?: Condition         // Condition for Ask If / Piping edges
  label?: string                // Edge label (e.g., "F1", "Ask If")
}

/**
 * QC Logic Graph
 */
export interface QCLogicGraph {
  nodes: QCNode[]
  edges: QCEdge[]
}

/**
 * Generated Syntax Output
 */
export interface GeneratedQCSyntax {
  countStatements: string[]     // COUNT statements
  checkStatements: string[]     // CHECK statements
  fullSyntax: string            // Complete SPSS syntax
}



