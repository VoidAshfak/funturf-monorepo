import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { MessageSquare, ScrollText } from "lucide-react"
import CommentsSection from "./CommentsSection"

const triggerClass =
    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand data-[state=active]:to-teal data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_22px_rgba(29,185,84,0.35)] dark:data-[state=active]:from-brand-light"

export default function RulesAndComments({ rules }) {
    const currentUser = {
        id: "u1",
        name: "Alice",
        avatar: "https://i.pravatar.cc/150?img=1",
    }
    return (
        <Tabs defaultValue="rules" className="w-full">
            <TabsList className="glass-chip mb-5 inline-flex h-auto gap-1 rounded-full p-1">
                <TabsTrigger value="rules" className={triggerClass}>
                    <ScrollText className="h-4 w-4" />
                    Rules
                </TabsTrigger>
                <TabsTrigger value="comments" className={triggerClass}>
                    <MessageSquare className="h-4 w-4" />
                    Comments
                </TabsTrigger>
            </TabsList>

            <TabsContent value="rules">
                <div className="glass-neutral rounded-2xl border border-border/60 p-5">
                    {rules ? (
                        <p className="whitespace-pre-wrap text-left text-sm text-foreground/90">
                            {rules}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No rules set for this match.
                        </p>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="comments">
                <CommentsSection currentUser={currentUser} />
            </TabsContent>
        </Tabs>
    )
}