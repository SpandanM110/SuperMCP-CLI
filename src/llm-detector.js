/**
 * LLM Detection & Configuration
 *
 * Auto-detects and configures local LLM endpoints with zero user configuration.
 */

import axios from 'axios';
import inquirer from 'inquirer';

export class LLMDetector {
  constructor() {
    this.endpoints = [
      {
        name: 'Ollama',
        endpoint: 'http://localhost:11434/api/generate',
        healthCheck: 'http://localhost:11434/api/tags',
        type: 'ollama',
        format: 'ollama',
      },
      {
        name: 'LM Studio',
        endpoint: 'http://localhost:1234/v1/chat/completions',
        healthCheck: 'http://localhost:1234/v1/models',
        type: 'openai',
        format: 'openai',
      },
      {
        name: 'vLLM',
        endpoint: 'http://localhost:8000/v1/chat/completions',
        healthCheck: 'http://localhost:8000/v1/models',
        type: 'openai',
        format: 'openai',
      },
      {
        name: 'Text Generation WebUI',
        endpoint: 'http://localhost:5000/v1/chat/completions',
        healthCheck: 'http://localhost:5000/v1/models',
        type: 'openai',
        format: 'openai',
      },
      {
        name: 'LocalAI',
        endpoint: 'http://localhost:8080/v1/chat/completions',
        healthCheck: 'http://localhost:8080/v1/models',
        type: 'openai',
        format: 'openai',
      },
    ];
  }

  async detect() {
    const results = await Promise.allSettled(
      this.endpoints.map((config) => this.testEndpoint(config))
    );

    const available = results
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value);

    if (available.length === 0) {
      return null;
    }

    if (available.length > 1) {
      return await this.promptUserChoice(available);
    }

    return available[0];
  }

  async testEndpoint(config) {
    try {
      const response = await axios.get(config.healthCheck, {
        timeout: 2000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        const models = await this.getModels(config);
        return {
          ...config,
          available: true,
          models: models || ['default'],
          detectedAt: new Date().toISOString(),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async getModels(config) {
    try {
      if (config.type === 'ollama') {
        const response = await axios.get('http://localhost:11434/api/tags');
        return response.data.models?.map((m) => m.name) || ['llama3.2'];
      } else {
        const response = await axios.get(config.healthCheck);
        return response.data.data?.map((m) => m.id) || ['default'];
      }
    } catch {
      return ['default'];
    }
  }

  async promptUserChoice(available) {
    const choices = available.map((config) => ({
      name: `${config.name} - ${config.endpoint} (${config.models?.length || 0} models)`,
      value: config,
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'llm',
        message: 'Multiple LLMs detected. Choose one:',
        choices,
      },
    ]);

    return answer.llm;
  }

  async testConnection(config, model) {
    try {
      const testPrompt = "Say 'Hello' and nothing else.";

      if (config.type === 'ollama') {
        const response = await axios.post(config.endpoint, {
          model: model || 'llama3.2',
          prompt: testPrompt,
          stream: false,
        });
        return response.data.response?.includes('Hello');
      } else {
        const response = await axios.post(config.endpoint, {
          model: model || 'default',
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 10,
        });
        return response.data.choices?.[0]?.message?.content?.includes('Hello');
      }
    } catch {
      return false;
    }
  }
}
