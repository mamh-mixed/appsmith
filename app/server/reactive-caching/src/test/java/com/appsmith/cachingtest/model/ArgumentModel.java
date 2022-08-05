package com.appsmith.cachingtest.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor(staticName = "of")
public class ArgumentModel {
    private String name;
}
