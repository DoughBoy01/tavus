import { IConversation } from '../types';
import { logger } from '@/utils/logger';

export const createConversation = async (): Promise<IConversation> => {
  try {
    logger.debug('Creating conversation (public access)');

    // First, let's check if there's an active Tavus configuration
    logger.debug('Checking for active Tavus configuration');
    const configResponse = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-config/active`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      }
    );

    logger.debug('Config response received', { status: configResponse.status });

    if (!configResponse.ok) {
      const configError = await configResponse.text();
      logger.error('Failed to get Tavus config', configError);
      throw new Error('Tavus configuration not available');
    }

    const config = await configResponse.json();
    logger.debug('Active Tavus config retrieved');

    // Now create the conversation
    logger.debug('Making request to conversation endpoint');
    const conversationResponse = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-conversation/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      }
    );

    logger.debug('Conversation response received', { status: conversationResponse.status });

    if (!conversationResponse?.ok) {
      const errorText = await conversationResponse.text();
      logger.error('Conversation creation error', errorText);
      throw new Error(`HTTP error! status: ${conversationResponse.status} - ${errorText}`);
    }

    const conversationData = await conversationResponse.json();
    logger.debug('Received conversation data', {
      hasUrl: !!conversationData.conversation_url,
      hasId: !!conversationData.conversation_id
    });

    // Validate that we have the required fields
    if (!conversationData.conversation_url) {
      logger.error('Missing conversation_url in response');
      throw new Error('Invalid response: missing conversation_url');
    }

    if (!conversationData.conversation_id) {
      logger.error('Missing conversation_id in response');
      throw new Error('Invalid response: missing conversation_id');
    }

    // Validate URL format
    if (!conversationData.conversation_url.includes('tavus.daily.co')) {
      logger.warn('Conversation URL is not in expected tavus.daily.co format', conversationData.conversation_url);
    }

    logger.info('Conversation created successfully');
    return conversationData;
  } catch (error) {
    logger.error('Error creating conversation', error);
    throw error;
  }
};