import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AIOperationPlan, OperationConstraints, Mission } from '../../types';

interface AIPlanningState {
  operationPlans: Record<string, AIOperationPlan>;
  currentPlanId: string | null;
  isGenerating: boolean;
  generationError: string | null;
  planningHistory: string[];
}

const initialState: AIPlanningState = {
  operationPlans: {},
  currentPlanId: null,
  isGenerating: false,
  generationError: null,
  planningHistory: [],
};

const aiPlanningSlice = createSlice({
  name: 'aiPlanning',
  initialState,
  reducers: {
    startPlanGeneration: (state) => {
      state.isGenerating = true;
      state.generationError = null;
    },
    planGenerationSuccess: (state, action: PayloadAction<AIOperationPlan>) => {
      state.operationPlans[action.payload.id] = action.payload;
      state.currentPlanId = action.payload.id;
      state.isGenerating = false;
      state.planningHistory.push(action.payload.id);
    },
    planGenerationFailure: (state, action: PayloadAction<string>) => {
      state.isGenerating = false;
      state.generationError = action.payload;
    },
    selectOperationPlan: (state, action: PayloadAction<string | null>) => {
      state.currentPlanId = action.payload;
    },
    updateOperationPlan: (state, action: PayloadAction<{ id: string; updates: Partial<AIOperationPlan> }>) => {
      const { id, updates } = action.payload;
      if (state.operationPlans[id]) {
        state.operationPlans[id] = { ...state.operationPlans[id], ...updates };
      }
    },
    deleteOperationPlan: (state, action: PayloadAction<string>) => {
      delete state.operationPlans[action.payload];
      if (state.currentPlanId === action.payload) {
        state.currentPlanId = null;
      }
      state.planningHistory = state.planningHistory.filter(id => id !== action.payload);
    },
    acceptSuggestedMission: (state, action: PayloadAction<{ planId: string; mission: Mission }>) => {
      // This will be handled by the mission slice
    },
    updateConstraints: (state, action: PayloadAction<{ planId: string; constraints: OperationConstraints }>) => {
      const { planId, constraints } = action.payload;
      if (state.operationPlans[planId]) {
        state.operationPlans[planId].constraints = constraints;
      }
    },
    clearGenerationError: (state) => {
      state.generationError = null;
    },
  },
});

export const {
  startPlanGeneration,
  planGenerationSuccess,
  planGenerationFailure,
  selectOperationPlan,
  updateOperationPlan,
  deleteOperationPlan,
  acceptSuggestedMission,
  updateConstraints,
  clearGenerationError,
} = aiPlanningSlice.actions;

export default aiPlanningSlice.reducer; 