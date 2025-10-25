import { trainingService } from '../services/trainingService';

export const apiClient = {
    getProfileSummary: () => trainingService.getProfileSummary(),
    updatePreferences: (payload) => trainingService.updatePreferences(payload),
    getTodaySession: () => trainingService.getTodaySession(),
    getWeekPlan: (date) => trainingService.getWeekPlan(date),
    getSession: (id) => trainingService.getSession(id),
    getRecentSessions: () => trainingService.getRecentSessions(),
    updateSession: (id, payload) => trainingService.updateSession(id, payload),
    rescheduleSession: (id, targetDate) => trainingService.rescheduleSession(id, targetDate),
    getReport: (slug, params) => trainingService.getReport(slug, params),
    getAchievements: () => trainingService.getAchievements(),
    getExerciseCatalog: () => trainingService.getExerciseCatalog(),
    getExerciseHistory: (exerciseKey) => trainingService.getExerciseHistory(exerciseKey),
};

export default apiClient;
