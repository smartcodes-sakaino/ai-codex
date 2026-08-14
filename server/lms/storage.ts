import {
  users,
  groups,
  userGroups,
  courses,
  courseChapters,
  courseAssignments,
  submissions,
  certificates,
  settings,
  videoProgress,
  selfReviewSubmissions,
  chapters,
  problems,
  type User,
  type Group,
  type Course,
  type Submission,
  type Certificate,
  type Settings as SettingsRow,
  type VideoProgress,
  type SelfReviewSubmission,
  type UserWithGroups,
  type CourseWithDetails,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export const lmsStorage = {
  // ============================================
  // Users
  // ============================================

  async getUsers(): Promise<UserWithGroups[]> {
    const allUsers = await db.select().from(users);
    const allMemberships = await db.select().from(userGroups);
    return allUsers.map((u) => ({
      ...u,
      groupIds: allMemberships.filter((m) => m.userId === u.id).map((m) => m.groupId),
    }));
  },

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  },

  async createUser(data: {
    name: string;
    email: string;
    role: "admin" | "learner";
    passwordHash: string;
    tempPassword: string;
    groupIds: string[];
  }): Promise<User> {
    const id = randomUUID();
    const [created] = await db
      .insert(users)
      .values({
        id,
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash: data.passwordHash,
        tempPassword: data.tempPassword,
      })
      .returning();
    if (data.groupIds.length > 0) {
      await db.insert(userGroups).values(data.groupIds.map((groupId) => ({ userId: id, groupId })));
    }
    return created;
  },

  async updateUserGroups(userId: string, groupIds: string[]): Promise<void> {
    await db.delete(userGroups).where(eq(userGroups.userId, userId));
    if (groupIds.length > 0) {
      await db.insert(userGroups).values(groupIds.map((groupId) => ({ userId, groupId })));
    }
  },

  async updateUser(
    userId: string,
    data: { name?: string; email?: string; groupIds?: string[] }
  ): Promise<User | undefined> {
    const fields: Partial<Pick<User, "name" | "email">> = {};
    if (data.name !== undefined) fields.name = data.name;
    if (data.email !== undefined) fields.email = data.email;

    let updated: User | undefined;
    if (Object.keys(fields).length > 0) {
      const [row] = await db.update(users).set(fields).where(eq(users.id, userId)).returning();
      updated = row;
    } else {
      updated = await this.getUserById(userId);
    }

    if (data.groupIds !== undefined) {
      await this.updateUserGroups(userId, data.groupIds);
    }

    return updated;
  },

  async regeneratePassword(userId: string, passwordHash: string, tempPassword: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ passwordHash, tempPassword })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  },

  // ============================================
  // Groups
  // ============================================

  async getGroups(): Promise<Group[]> {
    return await db.select().from(groups);
  },

  async createGroup(name: string): Promise<Group> {
    const id = randomUUID();
    const [created] = await db.insert(groups).values({ id, name }).returning();
    return created;
  },

  async deleteGroup(id: string): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  },

  // ============================================
  // Courses
  // ============================================

  async getCourses(): Promise<CourseWithDetails[]> {
    const allCourses = await db.select().from(courses);
    return Promise.all(allCourses.map((c) => this.attachCourseDetails(c)));
  },

  async getCourse(id: string): Promise<CourseWithDetails | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    if (!course) return undefined;
    return this.attachCourseDetails(course);
  },

  async attachCourseDetails(course: Course): Promise<CourseWithDetails> {
    const chapterRows = await db
      .select()
      .from(courseChapters)
      .where(eq(courseChapters.courseId, course.id))
      .orderBy(courseChapters.order);
    const assignmentRows = await db
      .select()
      .from(courseAssignments)
      .where(eq(courseAssignments.courseId, course.id));
    return {
      ...course,
      chapterIds: chapterRows.map((r) => r.chapterId),
      assignments: assignmentRows.map((r) => ({ type: r.targetType as "user" | "group", id: r.targetId })),
    };
  },

  async createCourse(data: {
    title: string;
    chapterIds: string[];
    assignments: { type: "user" | "group"; id: string }[];
  }): Promise<CourseWithDetails> {
    const id = randomUUID();
    const [created] = await db.insert(courses).values({ id, title: data.title }).returning();
    if (data.chapterIds.length > 0) {
      await db.insert(courseChapters).values(
        data.chapterIds.map((chapterId, index) => ({
          id: randomUUID(),
          courseId: id,
          chapterId,
          order: index,
        }))
      );
    }
    if (data.assignments.length > 0) {
      await db.insert(courseAssignments).values(
        data.assignments.map((a) => ({
          id: randomUUID(),
          courseId: id,
          targetType: a.type,
          targetId: a.id,
        }))
      );
    }
    return this.attachCourseDetails(created);
  },

  async deleteCourse(id: string): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  },

  /** Resolves the concrete list of users a course is assigned to (direct + via groups). */
  async usersForCourse(courseId: string): Promise<User[]> {
    const assignmentRows = await db
      .select()
      .from(courseAssignments)
      .where(eq(courseAssignments.courseId, courseId));

    const userIds = new Set<string>();
    const groupIds = assignmentRows.filter((a) => a.targetType === "group").map((a) => a.targetId);
    assignmentRows.filter((a) => a.targetType === "user").forEach((a) => userIds.add(a.targetId));

    if (groupIds.length > 0) {
      const memberships = await db
        .select()
        .from(userGroups)
        .where(inArray(userGroups.groupId, groupIds));
      memberships.forEach((m) => userIds.add(m.userId));
    }

    if (userIds.size === 0) return [];
    return await db.select().from(users).where(inArray(users.id, Array.from(userIds)));
  },

  /** Resolves the courses assigned to a given user (direct + via their groups). */
  async coursesForUser(userId: string): Promise<CourseWithDetails[]> {
    const memberships = await db.select().from(userGroups).where(eq(userGroups.userId, userId));
    const groupIds = memberships.map((m) => m.groupId);

    const allAssignments = await db.select().from(courseAssignments);
    const matchingCourseIds = new Set<string>();
    for (const a of allAssignments) {
      if (a.targetType === "user" && a.targetId === userId) matchingCourseIds.add(a.courseId);
      if (a.targetType === "group" && groupIds.includes(a.targetId)) matchingCourseIds.add(a.courseId);
    }
    if (matchingCourseIds.size === 0) return [];

    const courseRows = await db.select().from(courses).where(inArray(courses.id, Array.from(matchingCourseIds)));
    return Promise.all(courseRows.map((c) => this.attachCourseDetails(c)));
  },

  /** Flattens a course's chapters (in order) into an ordered list of problems. */
  async flattenCourse(courseId: string): Promise<{ chapterId: string; chapterTitle: string; problemId: string; problemTitle: string }[]> {
    const chapterRows = await db
      .select()
      .from(courseChapters)
      .where(eq(courseChapters.courseId, courseId))
      .orderBy(courseChapters.order);

    const result: { chapterId: string; chapterTitle: string; problemId: string; problemTitle: string }[] = [];
    for (const row of chapterRows) {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, row.chapterId));
      if (!chapter) continue;
      const problemRows = await db
        .select()
        .from(problems)
        .where(eq(problems.chapterId, row.chapterId))
        .orderBy(problems.order);
      for (const p of problemRows) {
        result.push({ chapterId: chapter.id, chapterTitle: chapter.title, problemId: p.id, problemTitle: p.title });
      }
    }
    return result;
  },

  // ============================================
  // Submissions
  // ============================================

  async getSubmissionsFor(userId: string, courseId: string, problemId: string): Promise<Submission[]> {
    return await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, userId),
          eq(submissions.courseId, courseId),
          eq(submissions.problemId, problemId)
        )
      )
      .orderBy(submissions.submittedAt);
  },

  async getAllSubmissionsForCourse(courseId: string): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.courseId, courseId));
  },

  async createSubmission(data: {
    userId: string;
    courseId: string;
    problemId: string;
    code: string;
    verdict: "pass" | "fail";
    aiSummary: string;
    aiGood?: string;
    aiImprove?: string;
    aiMustFix?: string;
  }): Promise<Submission> {
    const previous = await this.getSubmissionsFor(data.userId, data.courseId, data.problemId);
    const [created] = await db
      .insert(submissions)
      .values({
        id: randomUUID(),
        ...data,
        attemptNumber: previous.length + 1,
      })
      .returning();
    return created;
  },

  // ============================================
  // Certificates
  // ============================================

  async getCertificate(userId: string, courseId: string): Promise<Certificate | undefined> {
    const [cert] = await db
      .select()
      .from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
    return cert || undefined;
  },

  async getCertificateById(id: string): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
    return cert || undefined;
  },

  async createCertificate(data: {
    userId: string;
    courseId: string;
    certificateNumber: string;
    pdfObjectPath: string;
    companyNameSnapshot: string;
    issuerNameSnapshot: string;
  }): Promise<Certificate> {
    const [created] = await db
      .insert(certificates)
      .values({ id: randomUUID(), ...data })
      .returning();
    return created;
  },

  // ============================================
  // Settings
  // ============================================

  async getSettings(): Promise<SettingsRow> {
    const [existing] = await db.select().from(settings).where(eq(settings.id, "default"));
    if (existing) return existing;
    const [created] = await db
      .insert(settings)
      .values({ id: "default", companyName: "", issuerName: "" })
      .returning();
    return created;
  },

  async updateSettings(data: { companyName?: string; issuerName?: string; logoObjectPath?: string | null }): Promise<SettingsRow> {
    await this.getSettings(); // ensure row exists
    const [updated] = await db
      .update(settings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(settings.id, "default"))
      .returning();
    return updated;
  },

  // ============================================
  // Video progress
  // ============================================

  async getVideoProgress(userId: string, blockId: string): Promise<VideoProgress | undefined> {
    const [row] = await db
      .select()
      .from(videoProgress)
      .where(and(eq(videoProgress.userId, userId), eq(videoProgress.blockId, blockId)));
    return row || undefined;
  },

  // positionSeconds tracks the furthest point reached, so it must never move backward
  // (this is what makes forward-skip prevention meaningful for watch-time reporting).
  // completed is sticky — once true (the video was played to the end once), it never
  // reverts, since it gates roadmap progress for e-learning items with no self-review.
  async upsertVideoProgress(
    userId: string,
    blockId: string,
    positionSeconds: number,
    completed?: boolean
  ): Promise<VideoProgress> {
    const existing = await this.getVideoProgress(userId, blockId);
    const nextPosition = Math.max(existing?.positionSeconds ?? 0, positionSeconds);
    const nextCompleted = Boolean(existing?.completed) || Boolean(completed);
    const [row] = await db
      .insert(videoProgress)
      .values({ id: randomUUID(), userId, blockId, positionSeconds: nextPosition, completed: nextCompleted })
      .onConflictDoUpdate({
        target: [videoProgress.userId, videoProgress.blockId],
        set: { positionSeconds: nextPosition, completed: nextCompleted, updatedAt: new Date() },
      })
      .returning();
    return row;
  },

  // ============================================
  // Self review submissions
  // ============================================

  async getSelfReviewSubmissionsFor(userId: string, problemId: string): Promise<SelfReviewSubmission[]> {
    return await db
      .select()
      .from(selfReviewSubmissions)
      .where(and(eq(selfReviewSubmissions.userId, userId), eq(selfReviewSubmissions.problemId, problemId)))
      .orderBy(selfReviewSubmissions.submittedAt);
  },

  async createSelfReviewSubmission(data: {
    userId: string;
    problemId: string;
    verdict: "pass" | "fail";
    review: string;
  }): Promise<SelfReviewSubmission> {
    const [created] = await db
      .insert(selfReviewSubmissions)
      .values({ id: randomUUID(), ...data })
      .returning();
    return created;
  },
};
