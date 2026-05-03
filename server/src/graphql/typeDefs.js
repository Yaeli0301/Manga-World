export const typeDefs = /* GraphQL */ `
  type PageImg {
    index: Int!
    url: String!
    width: Int
    height: Int
  }

  type ReaderChapter {
    id: ID!
    number: Int!
    title: String!
    locked: Boolean!
    pages: [PageImg!]!
  }

  type ReaderMangaBrief {
    id: ID!
    title: String!
    isFavorite: Boolean!
  }

  type ReaderPayload {
    chapter: ReaderChapter!
    manga: ReaderMangaBrief!
  }

  type MangaListItem {
    id: ID!
    title: String!
    coverUrl: String
    description: String
    genres: [String!]!
    status: String
    trendingScore: Float
  }

  type CatalogPage {
    items: [MangaListItem!]!
    page: Int!
    hasMore: Boolean!
  }

  type UserPayload {
    id: ID!
    email: String!
    displayName: String
    roles: [String!]!
    readingStreak: Int!
    language: String
  }

  type LikeMutationResult {
    liked: Boolean!
    likeCount: Int!
  }

  type Query {
    health: Boolean!
    genres: [String!]!
    me: UserPayload
    trending(limit: Int): [MangaListItem!]!
    catalog(q: String, page: Int, limit: Int, sort: String, genre: String): CatalogPage!
    chapter(id: ID!): ReaderPayload
  }

  type Mutation {
    toggleCommentLike(commentId: ID!): LikeMutationResult!
  }
`;
