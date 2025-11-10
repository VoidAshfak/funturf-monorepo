import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import {mongoClient} from "../../prisma.js"

const sendTurfmateRequest = asyncHandler(async (req, res) => {
    const { receiverId } = req.body

    // Check if sender and receiver are the same
    if (req.user.id === receiverId) {
        throw new ApiError(400, "You cannot send a friend request to yourself")
    }

    try {
        // Already checked sender exists through auth middleware
        // Check if receiver exists. If not, then the receiver might have been deleted.
        const receiverExists = await mongoClient.user.findUnique({
            where: {
                id: receiverId
            }
        })

        if (!receiverExists) {
            throw new ApiError(400, "Receiver does not exist")
        }

        // Check if turfmate request already exists
        const turfmateRequest = await mongoClient.turfmateRequests.findFirst({
            where: {
                sender: req.user.id,
                receiver: receiverId
            }
        })
        if (turfmateRequest) {
            switch (turfmateRequest.status) {
                case "PENDING":
                    return res.status(204).json(new ApiResponse(401, "Request has already been sent and is in pending state.", turfmateRequest));

                case "ACCEPTED":
                    return res.status(200).json(new ApiResponse(401, "Already a turfmate.", turfmateRequest));

                case "REJECTED":
                    return res.status(200).json(new ApiResponse(401, "Receiver already rejected", turfmateRequest));

                default:
                    throw new ApiError(400, "Bad state")
            }
        }

        // Check if the receiver has already sent a turfmate request
        const turfmateReverseRequest = await mongoClient.turfmateRequests.findFirst({
            where: {
                sender: receiverId,
                receiver: req.user.id
            }
        })

        if (turfmateReverseRequest) {
            switch (turfmateReverseRequest.status) {
                case "PENDING":
                    return res.status(200).json(new ApiResponse(400, "There is already a pending request from the receiver."));

                case "ACCEPTED":
                    return res.status(200).json(new ApiResponse(401, "Already a turfmate.", turfmateReverseRequest));

                case "REJECTED":
                    return res.status(200).json(new ApiResponse(401, "You already rejected", turfmateReverseRequest));

                default:
                    throw new ApiError(400, "Bad state")
            }
        }


        const createdTurfmateRequest = await mongoClient.turfmateRequests.create({
            data: {
                sender: req.user.id,
                receiver: receiverId,
                status: "PENDING"
            }
        })
        return res.status(200).json(new ApiResponse(200, "Friend request sent", createdTurfmateRequest))
    } catch (error) {
        console.log("Something went wrong while sending turfmate request", error);
    }

});


// const sendTurfmateRequest = asyncHandler( async (req, res) => {
//   const senderId   = req.user.id;
//   const { receiverId } = req.body;

//   if (!receiverId) throw new ApiError(400, "receiverId is required");
//   if (senderId === receiverId) throw new ApiError(400, "Cannot send request to yourself");

//   // Verify receiver exists
//   const receiver = await mongoClient.user.findUnique({ where: { id: receiverId }, select: { id: true }});
//   if (!receiver) throw new ApiError(404, "Receiver not found");

//   // Atomic block: handle duplicates & create request
//   try {
//     const result = await mongoClient.$transaction(async (tx) => {

//       // Check reverse-pending
//       const reverse = await tx.turfmateRequest.findFirst({
//         where: {
//           senderId: receiverId,
//           receiverId: senderId,
//           status: 'PENDING'
//         }
//       });
//       if (reverse) {
//         // Accept it atomically
//         await tx.turfmateRequest.update({
//           where: { id: reverse.id },
//           data: { status: 'ACCEPTED' }
//         });
//         await tx.turfmate.createMany({
//           data: [
//             { userId: senderId,   turfmateId: receiverId },
//             { userId: receiverId, turfmateId: senderId }
//           ],
//           skipDuplicates: true
//         });
//         return { accepted: true };
//       }

//       // Otherwise insert new request; unique constraint will raise error if duplicate
//       await tx.turfmateRequest.create({
//         data: {
//           senderId,
//           receiverId,
//           status: 'PENDING'
//         }
//       });
//       return { accepted: false };
//     });

//     if (result.accepted) {
//       return res.status(200).json({ message: "Request mutually accepted" });
//     }
//     return res.status(201).json({ message: "Request sent" });  // 201 Created

//   } catch (err) {
//     if (err instanceof mongoClient.mongoClientClientKnownRequestError && err.code === "P2002") {
//       // unique(senderId,receiverId) violated
//       throw new ApiError(409, "Request already exists");
//     }
//     throw err; // bubble up to global error handler
//   }
// });


const getPendingRequests = asyncHandler(async (req, res) => {

    try {
        const pendingRequests = await mongoClient.turfmateRequests.findMany({
            where: {
                receiver: req.user.id,
                status: "PENDING"
            }
        })

        return res.status(200).json(new ApiResponse(200, "Pending turfmate requests", pendingRequests))
    } catch (error) {
        throw new ApiError(400, 'Something went wrong while getting pending turfmate requests', error);
    }
})

const acceptTurfmateRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.body;
    const receiver = req.user.id;
    try {
        const state = await mongoClient.turfmateRequests.findFirst({
            where: {
                id: requestId,
                receiver: receiver
            }
        })
        
        if (state && state.status === 'PENDING') {
            const acceptRequest = await mongoClient.turfmateRequests.update({
                where: {
                    id: requestId,
                    receiver: receiver
                },
                data: {
                    status: 'ACCEPTED'
                }
            })
            if (acceptRequest) {
                await mongoClient.turfmates.create({
                    data: {
                        userId: receiver,
                        turfmateId: acceptRequest.sender
                    }
                })

                return res.status(200).json({
                    success: true,
                    message: "Friend request accepted",
                    data: acceptRequest
                })
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Bad state"
            })
        }
    } catch (error) {
        throw new ApiError(400, 'Something went wrong while accepting turfmate request', error);
    }
})

const getTurfmates = asyncHandler(async (req, res) => {
    try {
        const turfmates = await mongoClient.turfmates.findMany({
            where: {
                OR: [
                    { userId: req.user.id },
                    { turfmateId: req.user.id }
                ]
            }
        })
        return res.status(200).json(new ApiResponse(200, "Turfmates", turfmates))
    } catch (error) {
        throw new ApiError(400, 'Something went wrong while getting turfmates', error);
    }
})

const getMutualTurfmates = asyncHandler(async (req, res) => {

    const { userTwo } = req.body
    try {
        const userOneFriend = await mongoClient.turfmate.findMany({
            where: {
                status: "FRIEND",
                OR: [
                    {
                        sender: req.user.id
                    },
                    {
                        receiver: req.user.id
                    }
                ]
            }
        })

        const userTwoFriend = await mongoClient.turfmate.findMany({
            where: {
                status: "FRIEND",
                OR: [
                    {
                        sender: userTwo
                    },
                    {
                        receiver: userTwo
                    }
                ]
            }
        })

        const turfmatesOfUserOne = userOneFriend.map((friend) => (
            friend.sender === req.user.id ? friend.receiver : friend.sender
        ))

        const turfmatesOfUserTwo = userTwoFriend.map((friend) => (
            friend.sender === userTwo ? friend.receiver : friend.sender
        ))

        const mutualFriendIds = turfmatesOfUserOne.filter(id =>
            turfmatesOfUserTwo.includes(id)
        );

        return res.status(200).json(new ApiResponse(200, "Mutual turfmates", mutualFriendIds))
    } catch (error) {
        throw new ApiError(400, 'Something went wrong while getting mutual turfmates', error);
    }

})

// const rejectTurfmateRequest = asyncHandler((req, res) => { })
// const ditachWithTurfmate = asyncHandler((req, res) => { })


export {
    sendTurfmateRequest,
    getPendingRequests,
    acceptTurfmateRequest,
    getTurfmates,
    getMutualTurfmates
}