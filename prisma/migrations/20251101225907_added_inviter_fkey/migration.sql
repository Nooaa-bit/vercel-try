-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
