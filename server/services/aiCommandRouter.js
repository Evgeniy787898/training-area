import internalAssistantEngine from './internalAssistantEngine.js';

class AiCommandRouter {
    async interpret({ profile, message, history = [] }) {
        return internalAssistantEngine.interpretCommand({ profile, message, history });
    }
}

const aiCommandRouter = new AiCommandRouter();

export default aiCommandRouter;
