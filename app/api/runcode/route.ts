import { NextResponse, NextRequest } from "next/server";
import axios from "axios";
import { db } from "../../../firebaseconfig";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";

export async function POST(req: Request) {
    try {
        const { code, language } = await req.json();

        if (!code || !language) {
            return NextResponse.json({ error: "Missing code or language" }, { status: 400 });
        }

        // JDoodle API Credentials (Use environment variables in production)
        const JDoodle_ClientId = "1ed425d3ed173afd308cf4d06b4ab096";
        const JDoodle_ClientSecret = "dca8fbbb4173d37d8fa9f4a7d7418bd010c0b26c05623c30e9f24ff6a1d4cc17";

        const response = await axios.post("https://api.jdoodle.com/v1/execute", {
            script: code,
            language: language,
            versionIndex: "0",
            clientId: JDoodle_ClientId,
            clientSecret: JDoodle_ClientSecret
        });

        return NextResponse.json({ output: response.data.output });
    } catch (error: any) {
        console.error("Code Execution Error:", error.response?.data || error.message);
        return NextResponse.json({ error: "Failed to execute code" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
      const featuredRef = doc(db, "featured", "topUsers");
      const featuredSnap = await getDoc(featuredRef);
      const now = new Date();
      let topUsers: any[] = [];
  
      if (featuredSnap.exists()) {
        const data = featuredSnap.data();
        const lastUpdated = data.lastUpdated?.toDate?.() || new Date(0);
        const ageInDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  
        if (ageInDays < 3 && data.users?.length > 0) {
          const topUserPromises = data.users.map(async (u: any) => {
            const profileRef = doc(db, "users", u.userId, "details", "profileData");
            const userRef = doc(db, "users", u.userId);
            const [profileSnap, userSnap] = await Promise.all([getDoc(profileRef), getDoc(userRef)]);
  
            if (profileSnap.exists() && userSnap.exists()) {
              const profile = profileSnap.data();
              const userData = userSnap.data();
              return {
                userId: u.userId,
                userType: userData.userType || "student",
                firstName: profile.firstName || "N/A",
                lastName: profile.lastName || "N/A",
                school: profile.school || "Unknown School",
                description: profile.bio || "No bio available",
                profileImageUrl: profile.profileImage || "",
                status: profile.status || "",
                volunteer: profile.volunteerAgreement || false,
                categoryCounts: profile.categoryCounts || { Game: 0, App: 0, Website: 0, Other: 0 },
                highlightCategory: u.highlightCategory,
              };
            }
            return null;
          });
  
          const resolved = await Promise.all(topUserPromises);
          topUsers = resolved.filter(Boolean);
        }
      }
  
      if (topUsers.length === 0) {
        const usersCollection = collection(db, "users");
        const userQuery = query(usersCollection, where("userType", "!=", "business"), limit(100));
        const userDocs = await getDocs(userQuery);
        const userPromises = userDocs.docs.map(async (userDoc) => {
          const userId = userDoc.id;
          const userType = userDoc.data().userType;
          const profileDocRef = doc(db, "users", userId, "details", "profileData");
          const profileDocSnap = await getDoc(profileDocRef);
  
          if (profileDocSnap.exists()) {
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
        });
  
        const resolvedUsers = await Promise.all(userPromises);
        const validUsers = resolvedUsers.filter(Boolean) as any[];
  
        const usedIds = new Set<string>();
        const featuredCards: any[] = [];
  
        const addTopUser = (category: string, key: keyof typeof validUsers[0]['categoryCounts']) => {
          const top = validUsers
            .filter(u => !usedIds.has(u.userId))
            .sort((a, b) => (b.categoryCounts?.[key] || 0) - (a.categoryCounts?.[key] || 0))[0];
          if (top) {
            top.highlightCategory = category;
            usedIds.add(top.userId);
            featuredCards.push(top);
          }
        };
  
        addTopUser("Game", "Game");
        addTopUser("App", "App");
        addTopUser("Website", "Website");
  
        const mostGeneral = validUsers
          .filter(u => !usedIds.has(u.userId))
          .sort((a, b) => {
            const totalA = (a.categoryCounts?.Game || 0) + (a.categoryCounts?.App || 0) + (a.categoryCounts?.Website || 0);
            const totalB = (b.categoryCounts?.Game || 0) + (b.categoryCounts?.App || 0) + (b.categoryCounts?.Website || 0);
            return totalB - totalA;
          })[0];
  
        if (mostGeneral) {
          mostGeneral.highlightCategory = "Number of";
          usedIds.add(mostGeneral.userId);
          featuredCards.unshift(mostGeneral);
        }
  
        topUsers = featuredCards;
      }
  
      return NextResponse.json({ featuredUsers: topUsers });
    } catch (error) {
      console.error("Featured Users Error:", error);
      return NextResponse.json({ error: "Failed to fetch featured users" }, { status: 500 });
    }
  }