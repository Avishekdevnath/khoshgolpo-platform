import MessagesWorkspace from "@/components/messages/MessagesWorkspace";

type MessageThreadPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function MessageThreadPage({ params }: MessageThreadPageProps) {
  const { conversationId } = await params;
  return <MessagesWorkspace conversationId={conversationId} />;
}
