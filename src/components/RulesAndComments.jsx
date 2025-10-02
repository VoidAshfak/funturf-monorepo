import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import CommentsSection from "./CommentsSection"

export default function RulesAndComments({rules}) {
    const currentUser = {
        id: "u1",
        name: "Alice",
        avatar: "https://i.pravatar.cc/150?img=1",
    }
    return (
        <Tabs defaultValue="rules" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rules">Rules</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
            </TabsList>
            <TabsContent value="rules">
                <div className="p-4 flex items-center bg-gray-50 rounded-2xl">
                    <p className="text-left">{rules}</p>
                </div>
            </TabsContent>
            <TabsContent value="comments">
                <div className="">
                    <CommentsSection currentUser={currentUser} />
                </div>
            </TabsContent>
        </Tabs>
    )
}