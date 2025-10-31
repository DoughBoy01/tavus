export const endConversation = async (conversationId: string, conversationData?: any) => {
  try {
    console.log('=== ENDING CONVERSATION (PUBLIC ACCESS) ===');
    console.log('Conversation ID:', conversationId);
    console.log('Conversation Data:', conversationData);

    // Call edge function to end conversation
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-conversation/end`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          conversation_id: conversationId,
          conversationData: conversationData 
        })
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to end conversation:', errorText);
      throw new Error("Failed to end conversation");
    }
    
    console.log('✅ Conversation ended successfully');
    return null;
  } catch (error) {
    console.error("Error ending conversation:", error);
    throw error;
  }
};