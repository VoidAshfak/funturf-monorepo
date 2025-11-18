import { Squirrel } from "lucide-react";

export default function EmptyState({ message = 'No items yet' }) {
    return (
        <div className="flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center max-w-md">

                <Squirrel />

                <p className="text-gray-500 mb-8">
                    {message}
                </p>

            </div>
        </div>
    )
}