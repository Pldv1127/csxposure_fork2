import { NextResponse, NextRequest } from "next/server";
import { db } from "../../../firebaseconfig";
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc } from "firebase/firestore";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const startAfterId = url.searchParams.get("startAfter");
        const limitParam = url.searchParams.get("limit");
        const pageSize = limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE;

        if (isNaN(pageSize) || pageSize <= 0) {
        return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
        }

        // Fetch one extra document to check if there's more data
        const fetchLimit = pageSize + 1;

        let usersQuery = query(
        collection(db, "users"),
        where("userType", "!=", "business"),
        orderBy("userType"),
        limit(fetchLimit)
        );

        if (startAfterId) {
        const lastDocRef = doc(db, "users", startAfterId);
        const lastDocSnap = await getDoc(lastDocRef);
        if (lastDocSnap.exists()) {
            usersQuery = query(
            collection(db, "users"),
            where("userType", "!=", "business"),
            orderBy("userType"),
            startAfter(lastDocSnap),
            limit(fetchLimit)
            );
        }
        }

        const userDocs = await getDocs(usersQuery);

        const users = await Promise.all(
        userDocs.docs.map(async (userDoc) => {
            const userId = userDoc.id;
            const userType = userDoc.data().userType;

            const profileDocRef = doc(db, "users", userId, "details", "profileData");
            const profileDocSnap = await getDoc(profileDocRef);

            if (profileDocSnap.exists() && userType !== "business") {
            const profile = profileDocSnap.data();
            return {
                userId,
                userType,
                firstName: profile.firstName || "N/A",
                lastName: profile.lastName || "N/A",
                school: profile.school || "Unknown School",
                description: profile.bio || "No bio available",
                profileImageUrl: profile.profileImage || "",
                status: profile.status || "",
                volunteer: profile.volunteerAgreement || false,
                categoryCounts: profile.categoryCounts || { Game: 0, App: 0, Website: 0, Other: 0 },
            };
            }
            return null;
        })
        );

        const filteredUsers = users.filter(Boolean);

        // Slice to exactly pageSize after filtering
        const limitedUsers = filteredUsers.slice(0, pageSize);

        // lastDoc is the ID of the last user in the returned limited list
        const lastVisibleId = limitedUsers.length > 0 ? limitedUsers[limitedUsers.length - 1].userId : null;

        // hasMore is true if more users exist beyond this page
        const hasMore = filteredUsers.length > pageSize;

        return NextResponse.json({
        users: limitedUsers,
        lastDoc: lastVisibleId,
        hasMore,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}
