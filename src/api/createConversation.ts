import { IConversation } from '../types';

export const createConversation = async (): Promise<IConversation> => {
  try {
    console.log('=== FRONTEND: Creating conversation (public access) ===');
    
    // First, let's check if there's an active Tavus configuration
    console.log('Checking for active Tavus configuration...');
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
    
    console.log('Config response status:', configResponse.status);
    
    if (!configResponse.ok) {
      const configError = await configResponse.text();
      console.error('Failed to get Tavus config:', configError);
      throw new Error('Tavus configuration not available');
    }
    
    const config = await configResponse.json();
    console.log('Active Tavus config:', config);
    
    // Now create the conversation
    console.log('Making request to conversation endpoint...');
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

    console.log('Conversation response status:', conversationResponse.status);

    if (!conversationResponse?.ok) {
      const errorText = await conversationResponse.text();
      console.error('Conversation creation error response:', errorText);
      throw new Error(`HTTP error! status: ${conversationResponse.status} - ${errorText}`);
    }

    const conversationData = await conversationResponse.json();
    console.log('=== FRONTEND: Received conversation data ===');
    console.log('Full response:', JSON.stringify(conversationData, null, 2));
    console.log('Conversation URL:', conversationData.conversation_url);
    console.log('Conversation ID:', conversationData.conversation_id);

    // Validate that we have the required fields
    if (!conversationData.conversation_url) {
      console.error('Missing conversation_url in response!');
      throw new Error('Invalid response: missing conversation_url');
    }

    if (!conversationData.conversation_id) {
      console.error('Missing conversation_id in response!');
      throw new Error('Invalid response: missing conversation_id');
    }

    // Validate URL format
    if (!conversationData.conversation_url.includes('tavus.daily.co')) {
      console.warn('Conversation URL is not in expected tavus.daily.co format:', conversationData.conversation_url);
    }

    console.log('✅ Conversation created successfully');
    return conversationData;
  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    throw error;
  }
};