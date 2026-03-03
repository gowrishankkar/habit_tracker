import { User, type IUser } from "./user.model.js";

export const userRepository = {
  async findByEmail(email: string) {
    return User.findOne({ email });
  },

  async findByEmailWithPassword(email: string) {
    return User.findOne({ email }).select("+password");
  },

  async findById(id: string) {
    return User.findById(id).lean();
  },

  async create(data: { name: string; email: string; password: string }): Promise<IUser> {
    return User.create(data);
  },
};
