-- District hospital → referral hospital: means of transport for onward transfer
ALTER TABLE "malaria_cases" ADD COLUMN "dhReferralToReferralHospitalTransport" "HcReferralTransport";
