'use client';
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { MessageSquare } from 'lucide-react';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';
import seedComments from '../../public/data/comments.json';

export default function CommentsSection({ currentUser }) {
    const [comments, setComments] = useState(seedComments);
    const scope = useRef(null);

    const tree = useMemo(() => buildTree(comments), [comments]);

    useGSAP(
        () => {
            gsap.from('.comment-root', {
                opacity: 0,
                y: 16,
                duration: 0.5,
                ease: 'power2.out',
                stagger: 0.08,
            });
        },
        { scope, dependencies: [tree.length] }
    );

    const addComment = (content, parentId = null) => {
        const newComment = {
            _id: `c${Date.now()}`,
            postId: 'post1',
            parentId,
            author: currentUser,
            content,
            likes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setComments((prev) => [...prev, newComment]);
    };

    const editComment = (id, content) =>
        setComments((prev) =>
            prev.map((c) =>
                c._id === id ? { ...c, content, updatedAt: new Date().toISOString() } : c
            )
        );

    const deleteComment = (id) =>
        setComments((prev) => {
            // drop the comment and any descendants
            const kill = new Set([id]);
            let grew = true;
            while (grew) {
                grew = false;
                for (const c of prev) {
                    if (c.parentId && kill.has(c.parentId) && !kill.has(c._id)) {
                        kill.add(c._id);
                        grew = true;
                    }
                }
            }
            return prev.filter((c) => !kill.has(c._id));
        });

    const toggleLike = (id) =>
        setComments((prev) =>
            prev.map((c) => {
                if (c._id !== id) return c;
                const liked = c.likes.includes(currentUser.id);
                return {
                    ...c,
                    likes: liked
                        ? c.likes.filter((u) => u !== currentUser.id)
                        : [...c.likes, currentUser.id],
                };
            })
        );

    const handlers = { addComment, editComment, deleteComment, toggleLike };

    return (
        <div ref={scope} className="space-y-6">
            {/* header */}
            <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare className="h-4 w-4" />
                </span>
                <h3 className="text-lg font-bold text-foreground">
                    Discussion
                    <span className="ml-2 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {comments.length}
                    </span>
                </h3>
            </div>

            {/* new comment */}
            <CommentForm
                currentUser={currentUser}
                onSubmit={(content) => addComment(content)}
            />

            {/* thread */}
            <div className="space-y-5">
                {tree.length === 0 ? (
                    <p className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                        No comments yet. Start the conversation.
                    </p>
                ) : (
                    tree.map((c) => (
                        <div key={c._id} className="comment-root">
                            <CommentItem
                                comment={c}
                                currentUser={currentUser}
                                handlers={handlers}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function buildTree(list) {
    const lookupTable = {},
        roots = [];

    list.forEach((commentObject) => {
        lookupTable[commentObject._id] = { ...commentObject, replies: [] };
    });

    list.forEach((commentObject) => {
        if (commentObject.parentId !== null) {
            lookupTable[commentObject.parentId]?.replies.push(
                lookupTable[commentObject._id]
            );
        } else {
            roots.push(lookupTable[commentObject._id]);
        }
    });

    return roots;
}
