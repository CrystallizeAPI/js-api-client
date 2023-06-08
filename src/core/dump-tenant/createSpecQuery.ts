export const getTenantBasicQuery = (tenantIdentifier: string): string => {
    return `query {
            tenant {
              get(identifier: "${tenantIdentifier}") {
                defaults {
                    language
                }
                availableLanguages {
                    code
                    name
                }
                id
                identifier
                staticAuthToken
              }
            }
          }`;
};

export const getTenantQueries = (tenantId: string) => {
    return {
        vatTypes: `query {
        tenant {
          get(id: "${tenantId}") {
            vatTypes {
              id
              tenantId
              name
              percent
            }
          }
        }
      }`,
        subscriptionPlans: `query {
        subscriptionPlan {
          getMany(tenantId: "${tenantId}") {
            identifier
            name
            meteredVariables {
              id
              identifier
              name
              unit
            }
            periods {
              id
              name
              initial {
                period
                unit
              }
              recurring {
                period
                unit
              }
            }
          }
        }
      }
    `,
        priceVariantsQuery: `query {
        priceVariant {
          getMany(tenantId: "${tenantId}") {
            identifier
            name
            currency
          }
        }
      }
    `,
        grids: `query GET_GRIDS($language: String!) {
	grid {
    getMany (
      tenantId: "${tenantId}"
      language: $language
    ) {
      id
      name
      rows {
        columns {
          item {
            externalReference
            tree {
              path(language: $language)
            }
          }
          layout {
            rowspan
            colspan
          }
        }
      }
    }
  }
}`,
        stockLocations: `query {
        stockLocation {
          getMany(tenantId: "${tenantId}") {
            identifier
            name
            settings {
              minimum
              unlimited
            }
          }
        }
      }`,
        shapes: `query {
        shape {
          getMany(tenantId: "${tenantId}") {
            id
            identifier
            type
            name
            components {
              ...componentBase
              config {
                ...primitiveComponentConfig
                ... on ContentChunkComponentConfig {
                  repeatable
                  components {
                    ...componentBase
                    config {
                      ...primitiveComponentConfig
                    }
                  }
                }
                ... on ComponentChoiceComponentConfig {
                  choices {
                    ...componentBase
                    config {
                      ...primitiveComponentConfig
                    }
                  }
                }
              }
            }
          }
        }
      }

      fragment componentBase on ShapeComponent {
        id
        name
        type
        description
      }

      fragment primitiveComponentConfig on ComponentConfig {
        ... on NumericComponentConfig {
          decimalPlaces
          units
        }
        ... on PropertiesTableComponentConfig {
          sections {
            title
            keys
          }
        }
        ... on SelectionComponentConfig {
          min
          max
          options {
            key
            value
            isPreselected
          }
        }
        ... on FilesComponentConfig {
          acceptedContentTypes {
            contentType
            extensionLabel
          }
          min
          max
          maxFileSize {
            size
            unit
          }
        }
        ... on ItemRelationsComponentConfig {
          acceptedShapeIdentifiers
          minSkus
          minItems
          maxSkus
          maxItems
        }
      }`,
        GET_ITEM: `query GET_ITEM ($language: String!, $path: String!) {
  catalogue(language: $language, path: $path) {
    ...item
    ...product
  }
}

fragment item on Item {
  id
  name
  type
  cataloguePath: path
  externalReference
  shape {
    identifier
  }
  topics {
    path
  }
  components {
    id
    name
    type
    content {
      ...primitiveComponentContent
      ... on ComponentChoiceContent {
        selectedComponent {
          id
          name
          type
          content {
            ...primitiveComponentContent
          }
        }
      }
      ... on ContentChunkContent {
        chunks {
          id
          name
          type
          content {
            ...primitiveComponentContent
          }
        }
      }
    }
  }
}

fragment primitiveComponentContent on ComponentContent {
  ...singleLineContent
  ...richTextContent
  ...imageContent
  ...videoContent
  ...fileContent
  ...paragraphCollectionContent
  ...itemRelationsContent
  ...gridRelationsContent
  ...locationContent
  ...selectionContent
  ...booleanContent
  ...propertiesTableContent
  ...dateTimeContent
  ...numericContent
}

fragment product on Product {
  id
  language
  vatType {
    name
    percent
  }
  variants {
    id
    externalReference
    name
    sku
    isDefault
    attributes {
      attribute
      value
    }
    priceVariants {
      identifier
      price
    }
    stock
    stockLocations {
      identifier
      name
      stock
    }
    images {
      ...image
    }
    subscriptionPlans {
      identifier
      name
      periods {
        id
        name
        initial {
          ...subscriptionPlanPricing
        }
        recurring {
          ...subscriptionPlanPricing
        }
      }
    }
  }
}

fragment image on Image {
  url
  altText
  caption {
    json
  }
}

fragment video on Video {
  id
  title
  playlist(type: "m3u8")
  thumbnails {
    ...image
  }
}

fragment file on File {
  url
  title
}

fragment dateTimeContent on DatetimeContent {
  datetime
}

fragment numericContent on NumericContent {
  number
  unit
}

fragment propertiesTableContent on PropertiesTableContent {
  sections {
    title
    properties {
      key
      value
    }
  }
}

fragment booleanContent on BooleanContent {
  value
}

fragment selectionContent on SelectionContent {
  options {
    key
    value
  }
}

fragment imageContent on ImageContent {
  images {
    ...image
  }
}

fragment videoContent on VideoContent {
  videos {
    ...video
  }
}

fragment fileContent on FileContent {
  files {
    ...file
  }
}

fragment singleLineContent on SingleLineContent {
  text
}

fragment richTextContent on RichTextContent {
  json
}

fragment itemRelationsContent on ItemRelationsContent {
  items {
    cataloguePath: path
    externalReference
  }
  productVariants {
    sku
    externalReference
  }
}

fragment gridRelationsContent on GridRelationsContent {
  grids {
    name
  }
}

fragment locationContent on LocationContent {
  lat
  long
}

fragment paragraphCollectionContent on ParagraphCollectionContent {
  paragraphs {
    title {
      ...singleLineContent
    }
    body {
      ...richTextContent
    }
    images {
      ...image
    }
  }
}

fragment subscriptionPlanPricing on ProductVariantSubscriptionPlanPricing {
  period
  unit
  priceVariants {
    identifier
    price
  }
  meteredVariables {
    id
    identifier
    name
    tierType
    tiers {
      threshold
      priceVariants {
        identifier
        price
      }
    }
  }
}
`,
    };
};
