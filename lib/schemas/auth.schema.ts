import { z } from "zod";

export const emailSchema = z.string().email("请输入有效的邮箱地址");

// 至少 8 位，且包含大写、小写、数字、特殊符号中的至少三种
const hasUppercase = /[A-Z]/;
const hasLowercase = /[a-z]/;
const hasNumber = /[0-9]/;
const hasSpecial = /[^A-Za-z0-9]/;

export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .refine(
    (val) => {
      let count = 0;
      if (hasUppercase.test(val)) count++;
      if (hasLowercase.test(val)) count++;
      if (hasNumber.test(val)) count++;
      if (hasSpecial.test(val)) count++;
      return count >= 3;
    },
    "密码须包含大写、小写、数字、特殊符号中的至少三种"
  );

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().min(2, "昵称至少 2 个字符").max(50, "昵称最多 50 个字符").optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "请输入密码"),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z.object({
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
