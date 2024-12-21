const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Scheduler → Pub/Sub (logout-check-topic) → この関数
 * 5分おきに呼ばれ、15分以上更新が無い & isLoggedIn=true のユーザーを一括ログアウトする
 */
exports.logoutCheckWorker = onMessagePublished(
  {
    topic: "logout-check-topic",
    region: "asia-northeast2",
  },
  async (event:any) => {
    try {
      console.log("logoutCheckWorker triggered by Pub/Sub message:", event);

      // 現在時刻 - 15分 (ミリ秒)
      const now = Date.now();
      const fifteenMinutesAgo = now - 15 * 60 * 1000;

      const usersRef = admin.firestore().collection("users");
      const querySnapshot = await usersRef
        .where("isLoggedIn", "==", true)
        .where("updatedAt", "<", new Date(fifteenMinutesAgo))
        .get();

      if (querySnapshot.empty) {
        console.log("No users found to logout.");
        return;
      }

      console.log(`Found ${querySnapshot.size} users to logout.`);


      const batch = admin.firestore().batch();
      querySnapshot.forEach((doc:any) => {
        const userRef = doc.ref;
        batch.update(userRef, { isLoggedIn: false });
      });

      await batch.commit();
      console.log("All matched users have been logged out.");
    } catch (error) {
      console.error("Error in logoutCheckWorker:", error);
    }
  }
);
