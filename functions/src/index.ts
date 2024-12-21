const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const admin = require("firebase-admin");

// Firebase Admin 初期化
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

      // Firestore上で  isLoggedIn = true かつ updatedAt < (15分前) のユーザーを検索
      // updatedAt は Timestamp型で保存されている前提
      // 例: collection("users").where("isLoggedIn", "==", true).where("updatedAt", "<", new Date(fifteenMinutesAgo))
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

      // 一括更新する方法はいくつかあり、
      // ここでは簡単に "forEach + update" してしまう例を示します。
      // ドキュメント数が多い場合はバッチ/トランザクション分割の工夫が必要になります。

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
