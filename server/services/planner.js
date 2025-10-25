import internalAssistantEngine from './internalAssistantEngine.js';

export class PlannerService {
    async generateTrainingPlan(userContext = {}) {
        try {
            return await internalAssistantEngine.generateTrainingPlan(userContext);
        } catch (error) {
            console.error('Error generating training plan:', error);
            throw new Error('Не удалось сгенерировать план тренировки');
        }
    }

    async analyzeTrainingReport(reportContext = {}) {
        try {
            return await internalAssistantEngine.analyzeTrainingReport(reportContext);
        } catch (error) {
            console.error('Error analyzing training report:', error);
            throw new Error('Не удалось проанализировать отчёт');
        }
    }

    async generateMotivationalMessage(context = {}) {
        try {
            return await internalAssistantEngine.buildMotivationMessage(context);
        } catch (error) {
            console.error('Error generating motivational message:', error);
            return 'Отличная работа! Продолжай в том же духе 💪';
        }
    }
}

export default new PlannerService();
