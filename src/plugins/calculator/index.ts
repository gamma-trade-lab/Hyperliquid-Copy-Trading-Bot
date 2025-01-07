import { Plugin } from "@ai16z/eliza";
import { calculateAction } from "./action.js";
import { calculateEvaluator } from "./evaluator.js";

export const calculatorPlugin: Plugin = {
  name: "calculator",
  description: "Basic arithmetic calculator plugin",
  actions: [calculateAction],
  evaluators: [calculateEvaluator],
  providers: [],
};
